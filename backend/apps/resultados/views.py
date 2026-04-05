from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView
from rest_framework import status, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.amostras.models import Amostra, StatusAmostra
from apps.core.utils import noop_ctx, resolver_operador
from apps.placas.models import Placa, Poco, StatusPlaca, TipoConteudoPoco
from apps.usuarios.permissions import IsEspecialista
from .models import ResultadoAmostra, ResultadoPoco

User = get_user_model()
from .parser import (
    parse_cfx_csv, validar_cp, validar_cn,
    classificar_canal, calcular_resultado_final,
    _CANAIS,
)
from .serializers import (
    ResultadoAmostraSerializer,
    ResultadoAmostraDetalheSerializer,
    ResultadoPocoSerializer,
    ResultadoImportSerializer,
)


# ── Página React ──────────────────────────────────────────────────────────────

@method_decorator(login_required, name='dispatch')
class RevisarResultadosView(TemplateView):
    """Página de revisão de resultados PCR (React via django-vite)."""
    template_name = 'resultados/revisar.html'


# ── ViewSet de resultados por poço (override manual) ─────────────────────────

class ResultadoPocoViewSet(viewsets.GenericViewSet,
                           viewsets.mixins.UpdateModelMixin):
    """
    PATCH /api/resultados/pocos/{id}/
    Permite que o operador PCR registre uma interpretação manual para um canal.
    Após o override, o ResultadoAmostra é recalculado automaticamente.
    """
    queryset = ResultadoPoco.objects.select_related(
        'poco__amostra', 'poco__resultado_amostra'
    ).all()
    serializer_class = ResultadoPocoSerializer
    permission_classes = [IsEspecialista]
    http_method_names = ['patch', 'head', 'options']

    def perform_update(self, serializer):
        instance = serializer.save()
        resultado_amostra = getattr(instance.poco, 'resultado_amostra', None)
        if resultado_amostra and not resultado_amostra.imutavel:
            resultado_amostra.recalcular_resultado_final()


# ── ViewSet de resultados por amostra ─────────────────────────────────────────

class ResultadoAmostraViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET  /api/resultados/                    — lista (aceita ?placa_id=X)
    GET  /api/resultados/{id}/               — detalhe com canais aninhados
    POST /api/resultados/importar/           — importa CSV do CFX Manager
    POST /api/resultados/{id}/confirmar/     — torna resultado imutável
    POST /api/resultados/{id}/liberar/       — libera resultado no GAL
    POST /api/resultados/{id}/solicitar-repeticao/ — solicita novo PCR
    """
    queryset = ResultadoAmostra.objects.select_related(
        'poco__amostra', 'poco__placa', 'confirmado_por'
    ).prefetch_related('poco__resultados').all()
    permission_classes = [IsEspecialista]

    def get_permissions(self):
        # Todas as ações requerem especialista ou supervisor
        return [IsEspecialista()]

    def get_serializer_class(self):
        # Inclui canais aninhados em todas as leituras (list, retrieve, importar)
        # para que o frontend possa editar overrides sem chamadas adicionais.
        if self.action in ('confirmar', 'liberar', 'solicitar_repeticao'):
            return ResultadoAmostraSerializer
        return ResultadoAmostraDetalheSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        placa_id = self.request.query_params.get('placa_id')
        if placa_id:
            qs = qs.filter(poco__placa_id=placa_id)
        amostra_id = self.request.query_params.get('amostra_id')
        if amostra_id:
            qs = qs.filter(poco__amostra_id=amostra_id)
        return qs

    # ------------------------------------------------------------------
    # Importar CSV do CFX Manager
    # ------------------------------------------------------------------

    @action(detail=False, methods=['post'], url_path='importar')
    def importar(self, request):
        """
        POST /api/resultados/importar/
        Body: multipart/form-data com 'arquivo' (CSV), 'placa_id' e opcionalmente 'numero_cracha'.

        Fluxo:
        1. Parseia o CSV do CFX Manager.
        2. Valida CP e CN — corrida inválida bloqueia o import.
        3. Cria/atualiza ResultadoPoco por poço × canal.
        4. Cria/atualiza ResultadoAmostra por amostra (classificação agregada).
        5. Atualiza status das amostras → Resultado.
        6. Atualiza status da placa → Resultados Importados.
        """
        serializer = ResultadoImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        arquivo = serializer.validated_data['arquivo']
        placa_id = serializer.validated_data['placa_id']

        # Placa
        try:
            placa = Placa.objects.prefetch_related('pocos__amostra').get(pk=placa_id)
        except Placa.DoesNotExist:
            return Response(
                {'erro': f'Placa {placa_id} não encontrada.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Parser
        content = arquivo.read()
        try:
            parsed = parse_cfx_csv(content, arquivo.name)
        except ValueError as exc:
            return Response({'erro': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        # Validação de controles — corrida inválida bloqueia import
        cp_ok, cp_msg = validar_cp(parsed['controles']['cp'])
        cn_ok, cn_msg = validar_cn(parsed['controles']['cn'])
        if not cp_ok or not cn_ok:
            return Response(
                {
                    'erro': 'Corrida inválida: controles não atendem os critérios IBMP.',
                    'cp': cp_msg,
                    'cn': cn_msg,
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        # Resolver operador para auditlog
        operador, actor_ctx, _err = resolver_operador(request)
        if actor_ctx is None:
            actor_ctx = noop_ctx()

        avisos: list[str] = []

        # Tudo a partir daqui é atômico e com actor correto no auditlog
        with transaction.atomic(), actor_ctx:
            return self._processar_import(request, placa, parsed, cp_msg, cn_msg, operador, avisos)

    def _processar_import(self, request, placa, parsed, cp_msg, cn_msg, operador, avisos):
        """Lógica interna de importação, executada dentro de transaction.atomic() + set_actor()."""
        # ── 1. ResultadoPoco por poço × canal ────────────────────────────────
        # Mapa de posição → Poco para acesso rápido
        poco_map: dict[str, Poco] = {
            p.posicao: p for p in placa.pocos.all()
        }

        for posicao, dados_poco in parsed['por_poco'].items():
            if dados_poco.get('_tipo') != 'amostra':
                continue  # controles não geram ResultadoPoco no banco

            poco = poco_map.get(posicao)
            if poco is None:
                avisos.append(
                    f'Poço {posicao} (amostra {dados_poco.get("_sample")}) '
                    'está no CSV mas não foi encontrado na placa — ignorado.'
                )
                continue

            for canal in _CANAIS:
                cq = dados_poco.get(canal)
                interpretacao = classificar_canal([cq], canal)
                ResultadoPoco.objects.update_or_create(
                    poco=poco,
                    canal=canal,
                    defaults={'cq': cq, 'interpretacao': interpretacao},
                )

        # ── 2. ResultadoAmostra por amostra (classificação agregada) ─────────
        amostras_processadas = 0
        for sample_id, canais in parsed['amostras'].items():
            # Localiza amostra pelo codigo_interno
            try:
                amostra = Amostra.objects.get(codigo_interno=sample_id)
            except Amostra.DoesNotExist:
                avisos.append(
                    f'Amostra "{sample_id}" não encontrada no banco — ignorada.'
                )
                continue

            # Poços dessa amostra nesta placa (para pegar o principal)
            pocos_amostra = list(
                Poco.objects.filter(placa=placa, amostra=amostra).order_by('posicao')
            )
            if not pocos_amostra:
                avisos.append(
                    f'Amostra "{sample_id}" não está mapeada nesta placa — ignorada.'
                )
                continue

            # Classificação usando Cq mínimo entre replicatas
            ci    = classificar_canal(canais['CI'],     'CI')
            hpv16 = classificar_canal(canais['HPV16'],  'HPV16')
            hpv18 = classificar_canal(canais['HPV18'],  'HPV18')
            hpvar = classificar_canal(canais['HPV_AR'], 'HPV_AR')
            resultado_final = calcular_resultado_final(ci, hpv16, hpv18, hpvar)

            poco_principal = pocos_amostra[0]

            # Não reimportar sobre resultado já confirmado
            try:
                ra = ResultadoAmostra.objects.get(poco=poco_principal)
                if ra.imutavel:
                    avisos.append(
                        f'Amostra "{sample_id}": resultado já confirmado — mantido.'
                    )
                    continue
                ra.ci_resultado    = ci
                ra.hpv16_resultado = hpv16
                ra.hpv18_resultado = hpv18
                ra.hpvar_resultado = hpvar
                ra.resultado_final = resultado_final
                ra.save(update_fields=[
                    'ci_resultado', 'hpv16_resultado', 'hpv18_resultado',
                    'hpvar_resultado', 'resultado_final',
                ])
            except ResultadoAmostra.DoesNotExist:
                ResultadoAmostra.objects.create(
                    poco=poco_principal,
                    ci_resultado=ci,
                    hpv16_resultado=hpv16,
                    hpv18_resultado=hpv18,
                    hpvar_resultado=hpvar,
                    resultado_final=resultado_final,
                )

            amostra.status = StatusAmostra.RESULTADO
            amostra.save(update_fields=['status', 'atualizado_em'])
            amostras_processadas += 1

        # ── 3. Atualiza status da placa ───────────────────────────────────────
        placa.status_placa = StatusPlaca.RESULTADOS_IMPORTADOS
        placa.save(update_fields=['status_placa', 'atualizado_em'])

        # ── 4. Resposta ───────────────────────────────────────────────────────
        resultados_qs = ResultadoAmostra.objects.filter(
            poco__placa=placa
        ).select_related('poco__amostra', 'confirmado_por').prefetch_related('poco__resultados')

        return Response(
            {
                'mensagem': f'{amostras_processadas} amostras processadas.',
                'cp': cp_msg,
                'cn': cn_msg,
                'avisos': avisos,
                'resultados': ResultadoAmostraDetalheSerializer(resultados_qs, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )

    # ------------------------------------------------------------------
    # Confirmar resultado (imutável)
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='confirmar')
    def confirmar(self, request, pk=None):
        """
        POST /api/resultados/{id}/confirmar/
        Torna o resultado imutável e registra o responsável.
        Aceita numero_cracha para atribuir a ação ao operador do crachá.
        """
        resultado = self.get_object()
        if resultado.imutavel:
            return Response(
                {'erro': 'Resultado já foi confirmado.'},
                status=status.HTTP_409_CONFLICT,
            )
        operador, actor_ctx, _err = resolver_operador(request)
        resultado.imutavel      = True
        resultado.confirmado_em  = timezone.now()
        resultado.confirmado_por = operador
        with actor_ctx:
            resultado.save(update_fields=['imutavel', 'confirmado_em', 'confirmado_por'])
        return Response(ResultadoAmostraDetalheSerializer(resultado).data)

    # ------------------------------------------------------------------
    # Liberar resultado no GAL
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='liberar')
    def liberar(self, request, pk=None):
        """
        POST /api/resultados/{id}/liberar/
        Requer resultado confirmado. Atualiza a amostra para Resultado Liberado.
        Aceita numero_cracha para atribuir a ação ao operador do crachá.
        """
        resultado = self.get_object()
        if not resultado.imutavel:
            return Response(
                {'erro': 'O resultado precisa ser confirmado antes de ser liberado.'},
                status=status.HTTP_409_CONFLICT,
            )
        operador, actor_ctx, _err = resolver_operador(request)
        amostra = resultado.poco.amostra
        if amostra and amostra.status != StatusAmostra.RESULTADO_LIBERADO:
            with actor_ctx:
                amostra.status = StatusAmostra.RESULTADO_LIBERADO
                amostra.save(update_fields=['status', 'atualizado_em'])
        return Response(ResultadoAmostraSerializer(resultado).data)

    # ------------------------------------------------------------------
    # Solicitar repetição de PCR
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='solicitar-repeticao')
    def solicitar_repeticao(self, request, pk=None):
        """
        POST /api/resultados/{id}/solicitar-repeticao/
        Marca a amostra para novo ciclo de PCR.
        Não pode ser aplicado a resultados já confirmados.
        Aceita numero_cracha para atribuir a ação ao operador do crachá.
        """
        resultado = self.get_object()
        if resultado.imutavel:
            return Response(
                {'erro': 'Resultado confirmado não pode solicitar repetição.'},
                status=status.HTTP_409_CONFLICT,
            )
        operador, actor_ctx, _err = resolver_operador(request)
        amostra = resultado.poco.amostra
        if amostra:
            with actor_ctx:
                amostra.status = StatusAmostra.REPETICAO_SOLICITADA
                amostra.save(update_fields=['status', 'atualizado_em'])
        return Response(
            {
                'mensagem': f'Repetição solicitada para amostra {amostra.codigo_interno if amostra else pk}.',
                'resultado': ResultadoAmostraSerializer(resultado).data,
            }
        )
