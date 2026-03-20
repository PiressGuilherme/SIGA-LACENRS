from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView
from rest_framework import status, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from .models import Amostra, StatusAmostra
from .serializers import AmostraSerializer
from .utils import parse_gal_file

# Status válidos para recebimento (aliquotagem)
_STATUS_RECEBIMENTO_VALIDOS = {
    StatusAmostra.AGUARDANDO_TRIAGEM,
    StatusAmostra.EXAME_EM_ANALISE,
}


@method_decorator(login_required, name='dispatch')
class ImportarCSVView(TemplateView):
    """Página de importação de CSV do GAL (React via django-vite)."""
    template_name = 'amostras/importar_csv.html'


@method_decorator(login_required, name='dispatch')
class RecebimentoView(TemplateView):
    """Página de recebimento/aliquotagem de amostras (React via django-vite)."""
    template_name = 'amostras/recebimento.html'


@method_decorator(login_required, name='dispatch')
class ConsultaAmostrasView(TemplateView):
    """Página de consulta de amostras para o usuário final (React via django-vite)."""
    template_name = 'amostras/consulta.html'

# Campos que podem ser atualizados numa reimportação quando estavam vazios
# (o cod_exame_gal já existe, mas o GAL agora trouxe novos dados)
CAMPOS_ATUALIZAVEIS = ('codigo_interno', 'data_recebimento')


class AmostraViewSet(viewsets.ModelViewSet):
    """
    ViewSet completo para Amostra.

    Endpoints extras:
      POST /api/amostras/preview-csv/   — parse do CSV sem salvar; retorna preview por linha
      POST /api/amostras/importar-csv/  — importa o CSV com lógica inteligente de duplicatas

    Lógica de importação:
      - 'Exame Cancelado' no GAL → ignorado (não entra no banco)
      - cod_exame_gal ainda não existe → cria novo registro (status: Recebida)
      - cod_exame_gal já existe, sem mudança → conta como 'duplicado' (sem ação)
      - cod_exame_gal já existe, mas codigo_interno ou data_recebimento agora chegaram
        preenchidos → atualiza apenas esses campos ('atualizado')
    """
    queryset = Amostra.objects.select_related('criado_por').all()
    serializer_class = AmostraSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()

        # Busca textual unificada (nome, CPF, CNS, código interno, GAL)
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(nome_paciente__icontains=search)
                | Q(cpf__icontains=search)
                | Q(cns__icontains=search)
                | Q(codigo_interno__icontains=search)
                | Q(cod_exame_gal__icontains=search)
                | Q(numero_gal__icontains=search)
            )

        # Filtros individuais
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        municipio = self.request.query_params.get('municipio')
        if municipio:
            qs = qs.filter(municipio__icontains=municipio)
        uf = self.request.query_params.get('uf')
        if uf:
            qs = qs.filter(uf=uf)

        # Ordenação
        ordering = self.request.query_params.get('ordering', '-criado_em')
        if ordering.lstrip('-') in self._ORDENAVEIS:
            qs = qs.order_by(ordering)

        return qs

    _ORDENAVEIS = {
        'codigo_interno', 'nome_paciente', 'status',
        'municipio', 'data_recebimento', 'criado_em',
    }

    def perform_create(self, serializer):
        serializer.save(criado_por=self.request.user)

    # ------------------------------------------------------------------
    # Filtros disponíveis para o frontend
    # ------------------------------------------------------------------

    @action(detail=False, methods=['get'], url_path='filtros')
    def filtros(self, request):
        """Retorna valores distintos de município e UF para popular dropdowns."""
        municipios = (
            Amostra.objects.exclude(municipio='')
            .values_list('municipio', flat=True)
            .distinct().order_by('municipio')
        )
        ufs = (
            Amostra.objects.exclude(uf='')
            .values_list('uf', flat=True)
            .distinct().order_by('uf')
        )
        return Response({
            'status_choices': [
                {'value': v, 'label': l} for v, l in StatusAmostra.choices
            ],
            'municipios': list(municipios),
            'ufs': list(ufs),
        })

    # ------------------------------------------------------------------
    # Helpers internos
    # ------------------------------------------------------------------

    def _build_existentes_map(self, rows: list[dict]) -> dict:
        """
        Retorna dict {cod_exame_gal: Amostra} para todos os registros
        do CSV que já existem no banco.
        """
        codigos = [r['cod_exame_gal'] for r in rows if r.get('cod_exame_gal')]
        return {
            a.cod_exame_gal: a
            for a in Amostra.objects.filter(cod_exame_gal__in=codigos)
            .only('id', 'cod_exame_gal', 'codigo_interno', 'data_recebimento')
        }

    def _detectar_updates(self, existente: Amostra, row: dict) -> dict:
        """
        Compara o registro existente com os novos dados do CSV e retorna
        apenas os campos que podem ser atualizados (estavam vazios, agora chegaram).
        """
        updates = {}
        for campo in CAMPOS_ATUALIZAVEIS:
            valor_existente = getattr(existente, campo, None)
            valor_novo = row.get(campo)
            if not valor_existente and valor_novo:
                updates[campo] = valor_novo
        return updates

    # ------------------------------------------------------------------
    # Endpoint de recebimento (aliquotagem)
    # ------------------------------------------------------------------

    @action(detail=False, methods=['post'], url_path='receber')
    def receber(self, request):
        """
        Confirma o recebimento/aliquotagem de uma amostra via leitura de código.

        Body: { "codigo": "<valor escaneado>" }

        Busca por: codigo_interno, cod_amostra_gal ou cod_exame_gal (nessa ordem).
        Valida que a amostra está em status Aguardando Triagem ou Exame em Análise.
        Atualiza o status para Aliquotada.
        """
        codigo = (request.data.get('codigo') or '').strip()
        if not codigo:
            return Response(
                {'erro': 'Nenhum código informado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Busca por múltiplos campos de identificação
        amostra = (
            Amostra.objects.filter(codigo_interno=codigo).first()
            or Amostra.objects.filter(cod_amostra_gal=codigo).first()
            or Amostra.objects.filter(cod_exame_gal=codigo).first()
        )

        if not amostra:
            return Response(
                {'erro': f'Amostra não encontrada para o código "{codigo}".'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if amostra.status == StatusAmostra.ALIQUOTADA:
            return Response(
                {
                    'aviso': 'Amostra já está aliquotada.',
                    'amostra': AmostraSerializer(amostra).data,
                },
                status=status.HTTP_200_OK,
            )

        if amostra.status not in _STATUS_RECEBIMENTO_VALIDOS:
            return Response(
                {
                    'erro': (
                        f'Amostra está com status "{amostra.get_status_display()}" '
                        f'e não pode ser recebida.'
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        amostra.status = StatusAmostra.ALIQUOTADA
        amostra.recebido_por = request.user
        amostra.save(update_fields=['status', 'recebido_por', 'atualizado_em'])

        return Response(
            {
                'sucesso': True,
                'amostra': AmostraSerializer(amostra).data,
            },
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # Endpoints de importação
    # ------------------------------------------------------------------

    @action(
        detail=False, methods=['post'],
        url_path='preview-csv',
        parser_classes=[MultiPartParser],
    )
    def preview_csv(self, request):
        """
        Recebe um arquivo CSV do GAL e retorna o preview das linhas sem salvar.

        Cada linha recebe '_status_importacao':
          - 'novo'        : será criado
          - 'duplicado'   : cod_exame_gal já existe e não há nada a atualizar
          - 'atualizavel' : cod_exame_gal já existe mas chegou codigo_interno ou data_recebimento
          - 'cancelado'   : Status Exame = Exame Cancelado — será ignorado na importação

        O resumo também inclui 'cancelados' (linhas ignoradas por status GAL).
        """
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response(
                {'erro': 'Nenhum arquivo enviado. Use o campo "file".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            rows, canceladas = parse_gal_file(csv_file.read(), csv_file.name)
        except (ValueError, Exception) as exc:
            return Response({'erro': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        existentes_map = self._build_existentes_map(rows)

        result = []
        for row in rows:
            cod = row.get('cod_exame_gal', '')
            if cod in existentes_map:
                updates = self._detectar_updates(existentes_map[cod], row)
                row['_status_importacao'] = 'atualizavel' if updates else 'duplicado'
                row['_campos_a_atualizar'] = list(updates.keys())
            else:
                row['_status_importacao'] = 'novo'
                row['_campos_a_atualizar'] = []

            # Serializar datas para ISO 8601
            for field in ('data_coleta', 'data_recebimento'):
                if row.get(field) is not None:
                    row[field] = row[field].isoformat()

            result.append(row)

        return Response({
            'total':        len(result) + canceladas,
            'novos':        sum(1 for r in result if r['_status_importacao'] == 'novo'),
            'atualizaveis': sum(1 for r in result if r['_status_importacao'] == 'atualizavel'),
            'duplicados':   sum(1 for r in result if r['_status_importacao'] == 'duplicado'),
            'cancelados':   canceladas,
            'amostras':     result,
        })

    @action(
        detail=False, methods=['post'],
        url_path='importar-csv',
        parser_classes=[MultiPartParser],
    )
    def importar_csv(self, request):
        """
        Importa o CSV do GAL para o banco de dados com lógica inteligente:

        - Exame Cancelado → ignorado
        - cod_exame_gal novo → cria registro (status derivado do Status Exame do GAL)
        - cod_exame_gal existente + novos dados (codigo_interno/data_recebimento)
          → atualiza apenas esses campos
        - cod_exame_gal existente sem novidade → conta como duplicado (sem ação)
        """
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response(
                {'erro': 'Nenhum arquivo enviado. Use o campo "file".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            rows, canceladas = parse_gal_file(csv_file.read(), csv_file.name)
        except (ValueError, Exception) as exc:
            return Response({'erro': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        existentes_map = self._build_existentes_map(rows)

        importadas = []
        atualizadas = []
        duplicadas = []
        erros = []

        for row in rows:
            cod = row.get('cod_exame_gal', '')

            # Remover campo auxiliar antes de criar/atualizar o model
            row.pop('_status_exame_gal', None)

            if cod in existentes_map:
                updates = self._detectar_updates(existentes_map[cod], row)
                if updates:
                    try:
                        Amostra.objects.filter(
                            cod_exame_gal=cod
                        ).update(**updates)
                        atualizadas.append({'cod_exame_gal': cod, 'campos': list(updates.keys())})
                    except Exception as exc:
                        erros.append({'cod_exame_gal': cod, 'erro': str(exc)})
                else:
                    duplicadas.append(cod)
                continue

            try:
                amostra = Amostra(**row)
                amostra.criado_por = request.user
                amostra.full_clean()
                amostra.save()
                importadas.append(cod)
            except Exception as exc:
                erros.append({'cod_exame_gal': cod, 'erro': str(exc)})

        http_status = (
            status.HTTP_201_CREATED
            if importadas
            else status.HTTP_200_OK
        )
        return Response(
            {
                'importadas':     len(importadas),
                'atualizadas':    len(atualizadas),
                'duplicadas':     len(duplicadas),
                'canceladas_gal': canceladas,
                'erros':          len(erros),
                'detalhes_atualizadas': atualizadas,
                'detalhes_erros':       erros,
            },
            status=http_status,
        )
