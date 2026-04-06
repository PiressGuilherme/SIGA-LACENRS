from contextlib import contextmanager

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView
from rest_framework import status, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.amostras.models import Amostra, StatusAmostra
from apps.amostras.serializers import AmostraSerializer
from apps.usuarios.permissions import IsTecnico, IsEspecialista, IsLaboratorio
from .models import Placa, Poco, StatusPlaca, TipoPlaca, TipoConteudoPoco
from .pdf import gerar_pdf_placa
from .serializers import PlacaSerializer, PocoInputSerializer

User = get_user_model()


@contextmanager
def _noop_ctx():
    yield


def _resolver_operador(request):
    """Resolve o operador a partir de numero_cracha ou fallback para request.user (superuser)."""
    from auditlog.context import set_actor
    numero_cracha = (request.data.get('numero_cracha') or '').strip()
    if numero_cracha:
        try:
            operador = User.objects.get(numero_cracha=numero_cracha, is_active=True)
        except User.DoesNotExist:
            return None, None, 'Crachá não reconhecido ou operador inativo.'
        return operador, set_actor(operador), None
    elif request.user.is_superuser:
        return request.user, set_actor(request.user), None
    else:
        return request.user, set_actor(request.user), None

# Statuses de amostra elegíveis para placa PCR (Extraída em diante, exceto cancelada)
STATUS_ELEGIVEIS_PCR = {
    StatusAmostra.EXTRAIDA,
    StatusAmostra.RESULTADO,
    StatusAmostra.RESULTADO_LIBERADO,
    StatusAmostra.REPETICAO_SOLICITADA,
}

# Statuses que já têm resultado — exigem confirmação antes de adicionar ao PCR
STATUS_COM_RESULTADO = {
    StatusAmostra.RESULTADO,
    StatusAmostra.RESULTADO_LIBERADO,
}


@method_decorator(login_required, name='dispatch')
class MontarPlacaView(TemplateView):
    """Página do módulo de Extração (React via django-vite)."""
    template_name = 'placas/montar.html'


@method_decorator(login_required, name='dispatch')
class PlacaPCRView(TemplateView):
    """Página do módulo de PCR (React via django-vite)."""
    template_name = 'placas/pcr.html'


class PlacaViewSet(viewsets.ModelViewSet):
    queryset = Placa.objects.prefetch_related('pocos__amostra').all()
    serializer_class = PlacaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        # Confirmar extração: qualquer perfil de laboratório (técnico, especialista, supervisor)
        if self.action == 'confirmar_extracao':
            return [IsLaboratorio()]
        # Enviar ao termociclador: apenas especialista ou supervisor
        if self.action == 'submeter':
            return [IsEspecialista()]
        # Criar/editar/excluir placa e salvar poços: qualquer perfil de laboratório
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'salvar_pocos'):
            return [IsLaboratorio()]
        # PDF, list, retrieve, buscar_amostra, rascunho_pcr: qualquer autenticado
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        tipo = self.request.query_params.get('tipo_placa')
        if tipo:
            qs = qs.filter(tipo_placa=tipo)
        status_param = self.request.query_params.get('status_placa')
        if status_param:
            qs = qs.filter(status_placa=status_param)
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(codigo__icontains=search)
        return qs

    def perform_create(self, serializer):
        serializer.save(responsavel=self.request.user)

    def perform_destroy(self, instance):
        """Ao excluir placa, reverte amostras vinculadas ao status anterior."""
        from auditlog.context import set_actor
        amostra_ids = instance._amostras_ids()
        actor_ctx = set_actor(self.request.user)
        with transaction.atomic(), actor_ctx:
            if amostra_ids:
                if instance.tipo_placa == TipoPlaca.EXTRACAO:
                    for amostra in Amostra.objects.filter(pk__in=amostra_ids):
                        amostra.status = StatusAmostra.ALIQUOTADA
                        amostra.save(update_fields=['status', 'atualizado_em'])
                elif instance.tipo_placa == TipoPlaca.PCR:
                    for amostra in Amostra.objects.filter(pk__in=amostra_ids, status=StatusAmostra.PCR):
                        amostra.status = StatusAmostra.EXTRAIDA
                        amostra.save(update_fields=['status', 'atualizado_em'])
            instance.delete()

    # ------------------------------------------------------------------
    # Buscar amostra elegível
    # ------------------------------------------------------------------

    @action(detail=False, methods=['get'], url_path='buscar-amostra')
    def buscar_amostra(self, request):
        """
        GET /api/placas/buscar-amostra/?codigo=<valor>[&modulo=pcr]

        Sem modulo (padrão / extração): retorna amostras com status Aliquotada.
        Com modulo=pcr: retorna amostras com status Extraída ou superior.
          - Inclui flag 'tem_resultado': true se amostra já tem resultado
            (exige confirmação no frontend antes de adicionar).
        """
        codigo = request.query_params.get('codigo', '').strip()
        modulo = request.query_params.get('modulo', '').strip().lower()

        if not codigo:
            return Response(
                {'erro': 'Parâmetro "codigo" obrigatório.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if modulo == 'pcr':
            # Buscar amostras com status elegível para PCR
            amostra = (
                Amostra.objects.filter(
                    codigo_interno=codigo, status__in=STATUS_ELEGIVEIS_PCR
                ).first()
                or Amostra.objects.filter(
                    cod_amostra_gal=codigo, status__in=STATUS_ELEGIVEIS_PCR
                ).first()
                or Amostra.objects.filter(
                    cod_exame_gal=codigo, status__in=STATUS_ELEGIVEIS_PCR
                ).first()
            )
            if not amostra:
                existe = (
                    Amostra.objects.filter(codigo_interno=codigo).first()
                    or Amostra.objects.filter(cod_amostra_gal=codigo).first()
                    or Amostra.objects.filter(cod_exame_gal=codigo).first()
                )
                if existe:
                    return Response(
                        {'erro': f'Amostra {codigo} está com status "{existe.get_status_display()}" — precisa estar Extraída ou superior.'},
                        status=status.HTTP_409_CONFLICT,
                    )
                return Response(
                    {'erro': f'Amostra "{codigo}" não encontrada.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            data = AmostraSerializer(amostra).data
            data['tem_resultado'] = amostra.status in STATUS_COM_RESULTADO
            return Response(data)

        else:
            # Extração: só amostras Aliquotadas
            amostra = (
                Amostra.objects.filter(codigo_interno=codigo, status=StatusAmostra.ALIQUOTADA).first()
                or Amostra.objects.filter(cod_amostra_gal=codigo, status=StatusAmostra.ALIQUOTADA).first()
                or Amostra.objects.filter(cod_exame_gal=codigo, status=StatusAmostra.ALIQUOTADA).first()
            )
            if not amostra:
                existe = (
                    Amostra.objects.filter(codigo_interno=codigo).first()
                    or Amostra.objects.filter(cod_amostra_gal=codigo).first()
                    or Amostra.objects.filter(cod_exame_gal=codigo).first()
                )
                if existe:
                    return Response(
                        {'erro': f'Amostra {codigo} está com status "{existe.get_status_display()}" — precisa estar Aliquotada.'},
                        status=status.HTTP_409_CONFLICT,
                    )
                return Response(
                    {'erro': f'Amostra "{codigo}" não encontrada.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            return Response(AmostraSerializer(amostra).data)

    # ------------------------------------------------------------------
    # Rascunho PCR a partir de uma placa de extração
    # ------------------------------------------------------------------

    @action(detail=True, methods=['get'], url_path='rascunho-pcr')
    def rascunho_pcr(self, request, pk=None):
        """
        GET /api/placas/{id}/rascunho-pcr/

        Retorna os poços de uma placa de extração formatados como rascunho
        para uma nova placa PCR. Só inclui amostras com status elegível (Extraída+).
        """
        placa_ext = self.get_object()
        if placa_ext.tipo_placa != TipoPlaca.EXTRACAO:
            return Response(
                {'erro': 'Apenas placas de extração podem ser usadas como rascunho PCR.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pocos_filtrados = []
        for poco in placa_ext.pocos.all():
            if poco.tipo_conteudo == TipoConteudoPoco.AMOSTRA:
                if poco.amostra and poco.amostra.status in STATUS_ELEGIVEIS_PCR:
                    pocos_filtrados.append({
                        'posicao': poco.posicao,
                        'tipo_conteudo': poco.tipo_conteudo,
                        'amostra_codigo': poco.amostra.codigo_interno,
                        'amostra_nome': poco.amostra.nome_paciente,
                        'tem_resultado': poco.amostra.status in STATUS_COM_RESULTADO,
                    })
                # Amostras não elegíveis são omitidas (poço fica vazio no rascunho)
            else:
                # CN, CP e vazios são copiados
                pocos_filtrados.append({
                    'posicao': poco.posicao,
                    'tipo_conteudo': poco.tipo_conteudo,
                    'amostra_codigo': '',
                    'amostra_nome': '',
                    'tem_resultado': False,
                })

        return Response({
            'placa_origem_id': placa_ext.id,
            'placa_origem_codigo': placa_ext.codigo,
            'pocos': pocos_filtrados,
        })

    # ------------------------------------------------------------------
    # Salvar poços (bulk)
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='salvar-pocos')
    def salvar_pocos(self, request, pk=None):
        """
        POST /api/placas/{id}/salvar-pocos/
        Body: { "pocos": [{ "posicao": "A01", "tipo_conteudo": "amostra", "amostra_codigo": "42/26" }, ...] }

        Para placa de extração: atualiza status das amostras para Extração.
        Para placa PCR: não altera status das amostras.
        """
        placa = self.get_object()

        if placa.status_placa != StatusPlaca.ABERTA:
            return Response(
                {'erro': 'Placa não está aberta para edição.'},
                status=status.HTTP_409_CONFLICT,
            )

        pocos_data = request.data.get('pocos', [])
        serializer = PocoInputSerializer(data=pocos_data, many=True)
        serializer.is_valid(raise_exception=True)

        pocos_to_create = []
        amostras_a_atualizar = []
        erros = []

        for item in serializer.validated_data:
            posicao = item['posicao']
            tipo = item['tipo_conteudo']
            amostra_codigo = item.get('amostra_codigo', '').strip() if item.get('amostra_codigo') else ''

            amostra = None
            if tipo == TipoConteudoPoco.AMOSTRA and amostra_codigo:
                amostra = Amostra.objects.filter(codigo_interno=amostra_codigo).first()
                if not amostra:
                    erros.append(f'Poço {posicao}: amostra "{amostra_codigo}" não encontrada.')
                    continue
                if placa.tipo_placa in (TipoPlaca.EXTRACAO, TipoPlaca.PCR):
                    amostras_a_atualizar.append(amostra.pk)

            grupo = item.get('grupo', 1)
            pocos_to_create.append(Poco(
                placa=placa, posicao=posicao, tipo_conteudo=tipo, amostra=amostra, grupo=grupo,
            ))

        if erros:
            return Response({'erros': erros}, status=status.HTTP_400_BAD_REQUEST)

        tipos = {item['tipo_conteudo'] for item in serializer.validated_data}
        if TipoConteudoPoco.CONTROLE_NEGATIVO not in tipos:
            return Response(
                {'erros': ['A placa precisa de pelo menos um Controle Negativo (CN).']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if TipoConteudoPoco.CONTROLE_POSITIVO not in tipos:
            return Response(
                {'erros': ['A placa precisa de pelo menos um Controle Positivo (CP).']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        operador, actor_ctx, _err = _resolver_operador(request)
        if actor_ctx is None:
            actor_ctx = _noop_ctx()

        with transaction.atomic(), actor_ctx:
            placa.pocos.all().delete()
            Poco.objects.bulk_create(pocos_to_create)
            if amostras_a_atualizar:
                novo_status = (
                    StatusAmostra.PCR if placa.tipo_placa == TipoPlaca.PCR
                    else StatusAmostra.EXTRACAO
                )
                for amostra in Amostra.objects.filter(pk__in=amostras_a_atualizar):
                    amostra.status = novo_status
                    amostra.save(update_fields=['status', 'atualizado_em'])

        placa.refresh_from_db()
        return Response(PlacaSerializer(placa).data)

    # ------------------------------------------------------------------
    # PDF do espelho de placa
    # ------------------------------------------------------------------

    @action(detail=True, methods=['get'], url_path='pdf')
    def pdf(self, request, pk=None):
        placa = self.get_object()
        # PDF de placa PCR: restrito a especialista ou supervisor (mesma regra do termociclador)
        if placa.tipo_placa == TipoPlaca.PCR:
            perm = IsEspecialista()
            if not perm.has_permission(request, self):
                return Response(
                    {'erro': 'Exportar PDF de placa PCR é restrito ao perfil Especialista ou Supervisor.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        pdf_bytes = gerar_pdf_placa(placa, operador=request.user)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{placa.codigo}.pdf"'
        return response

    # ------------------------------------------------------------------
    # Confirmar extração (só para placas de extração)
    # ------------------------------------------------------------------

    @action(detail=False, methods=['post'], url_path='confirmar-extracao')
    def confirmar_extracao(self, request):
        """
        POST /api/placas/confirmar-extracao/
        Body: { "codigo": "HPV240326-1" }

        Scan do código da placa de extração → amostras → Extraída; placa → Extração confirmada.
        """
        codigo = (request.data.get('codigo') or '').strip()
        if not codigo:
            return Response(
                {'erro': 'Código da placa não informado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        placa = Placa.objects.prefetch_related('pocos__amostra').filter(
            codigo=codigo, tipo_placa=TipoPlaca.EXTRACAO,
        ).first()
        if not placa:
            return Response(
                {'erro': f'Placa de extração "{codigo}" não encontrada.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if placa.status_placa != StatusPlaca.ABERTA:
            return Response(
                {'erro': f'Placa "{codigo}" já foi processada (status: {placa.get_status_placa_display()}).'},
                status=status.HTTP_409_CONFLICT,
            )

        # Validação de crachá do operador
        operador, _ctx, err = _resolver_operador(request)
        if err:
            return Response({'erro': err}, status=status.HTTP_400_BAD_REQUEST)
        numero_cracha = (request.data.get('numero_cracha') or '').strip()
        if not numero_cracha and not request.user.is_superuser:
            return Response(
                {'erro': 'Informe o código do crachá do operador para confirmar a extração.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        placa.confirmar_extracao(operador=operador)
        return Response({'sucesso': True, 'placa': PlacaSerializer(placa).data})

    # ------------------------------------------------------------------
    # Submeter ao termociclador (só para placas PCR)
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='submeter')
    def submeter(self, request, pk=None):
        """
        POST /api/placas/{id}/submeter/

        Envia a placa PCR ao termociclador (placa → Submetida).
        """
        placa = self.get_object()

        if placa.tipo_placa != TipoPlaca.PCR:
            return Response(
                {'erro': 'Apenas placas PCR podem ser submetidas ao termociclador.'},
                status=status.HTTP_409_CONFLICT,
            )

        if placa.status_placa != StatusPlaca.ABERTA:
            return Response(
                {'erro': f'Placa já foi submetida (status: {placa.get_status_placa_display()}).'},
                status=status.HTTP_409_CONFLICT,
            )

        operador, actor_ctx, _err = _resolver_operador(request)
        if actor_ctx is None:
            actor_ctx = _noop_ctx()
        with actor_ctx:
            placa.submeter_termociclador()
        return Response(PlacaSerializer(placa).data)

    @action(detail=True, methods=['post'], url_path='replicata')
    def replicata(self, request, pk=None):
        """
        POST /api/placas/{id}/replicata/

        Cria uma nova placa PCR copiando os poços de uma placa que falhou.
        A placa original deve estar em status submetida ou resultados_importados.
        """
        placa_original = self.get_object()

        if placa_original.tipo_placa != TipoPlaca.PCR:
            return Response(
                {'erro': 'Apenas placas PCR podem ter replicata.'},
                status=status.HTTP_409_CONFLICT,
            )

        if placa_original.status_placa not in (StatusPlaca.SUBMETIDA, StatusPlaca.RESULTADOS_IMPORTADOS):
            return Response(
                {'erro': f'Placa deve estar Submetida ou com Resultados Importados para gerar replicata.'},
                status=status.HTTP_409_CONFLICT,
            )

        operador, actor_ctx, _err = _resolver_operador(request)
        if actor_ctx is None:
            actor_ctx = _noop_ctx()

        with transaction.atomic(), actor_ctx:
            # Cria nova placa PCR
            nova_placa = Placa.objects.create(
                tipo_placa=TipoPlaca.PCR,
                placa_origem=placa_original.placa_origem,
                responsavel=operador,
                observacoes=f'Replicata de {placa_original.codigo}',
            )

            # Copia todos os poços da placa original
            pocos_originais = placa_original.pocos.all()
            pocos_para_criar = []
            for poco in pocos_originais:
                pocos_para_criar.append(Poco(
                    placa=nova_placa,
                    amostra=poco.amostra,
                    posicao=poco.posicao,
                    tipo_conteudo=poco.tipo_conteudo,
                ))
            Poco.objects.bulk_create(pocos_para_criar)

        return Response(PlacaSerializer(nova_placa).data, status=status.HTTP_201_CREATED)
