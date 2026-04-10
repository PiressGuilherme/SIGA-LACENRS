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
from apps.placas.models import Placa, Poco, StatusPlaca, TipoConteudoPoco
from apps.usuarios.permissions import IsEspecialista
from apps.utils.auditoria import noop_ctx as _noop_ctx, resolver_operador as _resolver_operador
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
        return [IsEspecialista()]

    def get_serializer_class(self):
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
        Body: multipart/form-data com 'arquivo' (CSV), 'placa_id' e opcionalmente
              'numero_cracha', 'kit_id', 'forcar_import' (ignorar validação).

        Fluxo:
        1. Parseia o CSV do CFX Manager.
        2. Valida CP e CN — se falhar, retorna 422 com detalhes ANTES de questionar ao usuário.
        3. Se forcar_import=true, prossegue mesmo com controles inválidos.
        4. Cria/atualiza ResultadoPoco por poço × canal.
        5. Cria/atualiza ResultadoAmostra por amostra (marca cp_valido/cn_valido=False se forçado).
        6. Atualiza status das amostras → Resultado.
        7. Atualiza status da placa → Resultados Importados.
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

        # Carregar kit de interpretação (do request ou default)
        kit = None
        kit_id = request.data.get('kit_id')
        if kit_id:
            from apps.configuracoes.models import KitInterpretacao
            kit = KitInterpretacao.objects.prefetch_related(
                'alvos__limiares', 'regras_interpretacao'
            ).filter(pk=kit_id, ativo=True).first()

        # Motor de interpretação configurado vs. fallback para parser legado
        motor = None
        if kit and kit.alvos.exists():
            from apps.configuracoes.engine import MotorInterpretacao
            motor = MotorInterpretacao(kit)

        # Validação de controles
        cp_detalhes = {}
        cn_detalhes = {}
        if motor:
            cp_ok, cp_msg, cp_detalhes = motor.validar_cp(parsed['controles']['cp'])
            cn_ok, cn_msg, cn_detalhes = motor.validar_cn(parsed['controles']['cn'])
        else:
            cq_ctrl = kit.cq_controle_max if kit else None
            cp_kwargs = {'cq_max': cq_ctrl} if cq_ctrl else {}
            cp_ok, cp_msg = validar_cp(parsed['controles']['cp'], **cp_kwargs)
            cn_ok, cn_msg = validar_cn(parsed['controles']['cn'], **cp_kwargs)

        # Se controles falharam e o usuário não quer forçar, retorna 422
        forcar_import = request.data.get('forcar_import', '').lower() in ('true', '1', 'on')
        if (not cp_ok or not cn_ok) and not forcar_import:
            kit_nome = kit.nome if kit else 'IBMP (padrão)'
            return Response(
                {
                    'erro': f'Corrida inválida: controles não atendem os critérios do kit {kit_nome}.',
                    'cp': cp_msg,
                    'cn': cn_msg,
                    'cp_detalhes': cp_detalhes,
                    'cn_detalhes': cn_detalhes,
                    'pode_forcar': True,
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        # Resolver operador para auditlog
        operador, actor_ctx, _err = _resolver_operador(request)
        if actor_ctx is None:
            actor_ctx = _noop_ctx()

        avisos: list[str] = []

        # Salvar kit na placa
        if kit:
            placa.kit_interpretacao = kit
            placa.save(update_fields=['kit_interpretacao', 'atualizado_em'])

        # Limiares para classificação legada (usados quando motor=None)
        classif_kwargs = {}
        if not motor and kit:
            if kit.cq_amostra_ci_max:
                classif_kwargs['cq_ci_max'] = kit.cq_amostra_ci_max
            if kit.cq_amostra_hpv_max:
                classif_kwargs['cq_hpv_max'] = kit.cq_amostra_hpv_max

        # Mensagem de aviso se forçou import com controles inválidos
        if forcar_import and (not cp_ok or not cn_ok):
            avisos.append(
                f'⚠ IMPORT FORÇADO COM CONTROLES INVÁLIDOS: '
                f'{cp_msg if not cp_ok else ""} {cn_msg if not cn_ok else ""}'.strip()
            )

        with transaction.atomic(), actor_ctx:
            return self._processar_import(
                request, placa, parsed, cp_msg, cn_msg, operador, avisos,
                classif_kwargs=classif_kwargs,
                motor=motor,
                cp_ok=cp_ok,
                cn_ok=cn_ok,
            )

    def _processar_import(
        self, request, placa, parsed, cp_msg, cn_msg, operador, avisos,
        classif_kwargs=None, motor=None, cp_ok=True, cn_ok=True,
    ):
        """Lógica interna de importação, dentro de transaction.atomic()."""
        ck = classif_kwargs or {}

        # ── 1. ResultadoPoco por poço × canal ────────────────────────────────
        poco_map: dict[str, Poco] = {p.posicao: p for p in placa.pocos.all()}

        for posicao, dados_poco in parsed['por_poco'].items():
            if dados_poco.get('_tipo') != 'amostra':
                continue

            poco = poco_map.get(posicao)
            if poco is None:
                avisos.append(
                    f'Poço {posicao} (amostra {dados_poco.get("_sample")}) '
                    'está no CSV mas não foi encontrado na placa — ignorado.'
                )
                continue

            if motor:
                for alvo in motor.canais_amostra:
                    cq = dados_poco.get(alvo.nome)
                    interpretacao = motor.classificar_alvo([cq], alvo.nome)
                    ResultadoPoco.objects.update_or_create(
                        poco=poco,
                        canal=alvo.nome,
                        defaults={'cq': cq, 'interpretacao': interpretacao},
                    )
            else:
                for canal in _CANAIS:
                    cq = dados_poco.get(canal)
                    interpretacao = classificar_canal([cq], canal, **ck)
                    ResultadoPoco.objects.update_or_create(
                        poco=poco,
                        canal=canal,
                        defaults={'cq': cq, 'interpretacao': interpretacao},
                    )

        # ── 2. ResultadoAmostra por amostra ──────────────────────────────────
        amostras_processadas = 0
        for sample_id, canais in parsed['amostras'].items():
            try:
                amostra = Amostra.objects.get(codigo_interno=sample_id)
            except Amostra.DoesNotExist:
                avisos.append(f'Amostra "{sample_id}" não encontrada no banco — ignorada.')
                continue

            pocos_amostra = list(
                Poco.objects.filter(placa=placa, amostra=amostra).order_by('posicao')
            )
            if not pocos_amostra:
                avisos.append(f'Amostra "{sample_id}" não está mapeada nesta placa — ignorada.')
                continue

            # Classificação por alvo
            if motor:
                resultados_alvos = {
                    alvo.nome: motor.classificar_alvo(canais.get(alvo.nome, []), alvo.nome)
                    for alvo in motor.canais_amostra
                }
                resultado = motor.interpretar_amostra(resultados_alvos, cp_ok, cn_ok)
                ci    = resultados_alvos.get('CI',     'invalido')
                hpv16 = resultados_alvos.get('HPV16',  'negativo')
                hpv18 = resultados_alvos.get('HPV18',  'negativo')
                hpvar = resultados_alvos.get('HPV_AR', 'negativo')
                resultado_final = resultado['codigo'] or 'invalido'
            else:
                ci    = classificar_canal(canais.get('CI',     []), 'CI',     **ck)
                hpv16 = classificar_canal(canais.get('HPV16',  []), 'HPV16',  **ck)
                hpv18 = classificar_canal(canais.get('HPV18',  []), 'HPV18',  **ck)
                hpvar = classificar_canal(canais.get('HPV_AR', []), 'HPV_AR', **ck)
                resultado_final = calcular_resultado_final(ci, hpv16, hpv18, hpvar)

            poco_principal = pocos_amostra[0]

            # Não reimportar sobre resultado já confirmado
            motivo_controle = ''
            if not cp_ok:
                motivo_controle += f'CP inválido: {cp_msg}. '
            if not cn_ok:
                motivo_controle += f'CN inválido: {cn_msg}. '

            try:
                ra = ResultadoAmostra.objects.get(poco=poco_principal)
                if ra.imutavel:
                    avisos.append(f'Amostra "{sample_id}": resultado já confirmado — mantido.')
                    continue
                ra.ci_resultado    = ci
                ra.hpv16_resultado = hpv16
                ra.hpv18_resultado = hpv18
                ra.hpvar_resultado = hpvar
                ra.resultado_final = resultado_final
                ra.cp_valido = cp_ok
                ra.cn_valido = cn_ok
                ra.motivo_controle_invalido = motivo_controle
                ra.save(update_fields=[
                    'ci_resultado', 'hpv16_resultado', 'hpv18_resultado',
                    'hpvar_resultado', 'resultado_final',
                    'cp_valido', 'cn_valido', 'motivo_controle_invalido',
                ])
            except ResultadoAmostra.DoesNotExist:
                ResultadoAmostra.objects.create(
                    poco=poco_principal,
                    ci_resultado=ci,
                    hpv16_resultado=hpv16,
                    hpv18_resultado=hpv18,
                    hpvar_resultado=hpvar,
                    resultado_final=resultado_final,
                    cp_valido=cp_ok,
                    cn_valido=cn_ok,
                    motivo_controle_invalido=motivo_controle,
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
        resultado = self.get_object()
        if resultado.imutavel:
            return Response(
                {'erro': 'Resultado já foi confirmado.'},
                status=status.HTTP_409_CONFLICT,
            )
        operador, actor_ctx, err = _resolver_operador(request)
        if err:
            return Response({'erro': err}, status=status.HTTP_400_BAD_REQUEST)
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
        resultado = self.get_object()
        if not resultado.imutavel:
            return Response(
                {'erro': 'O resultado precisa ser confirmado antes de ser liberado.'},
                status=status.HTTP_409_CONFLICT,
            )
        operador, actor_ctx, err = _resolver_operador(request)
        if err:
            return Response({'erro': err}, status=status.HTTP_400_BAD_REQUEST)
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
        resultado = self.get_object()
        if resultado.imutavel:
            return Response(
                {'erro': 'Resultado confirmado não pode solicitar repetição.'},
                status=status.HTTP_409_CONFLICT,
            )
        operador, actor_ctx, err = _resolver_operador(request)
        if err:
            return Response({'erro': err}, status=status.HTTP_400_BAD_REQUEST)
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
