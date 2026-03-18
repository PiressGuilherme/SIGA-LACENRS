from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView
from rest_framework import status, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from .models import Amostra
from .serializers import AmostraSerializer
from .utils import parse_gal_csv


@method_decorator(login_required, name='dispatch')
class ImportarCSVView(TemplateView):
    """Página de importação de CSV do GAL (React via django-vite)."""
    template_name = 'amostras/importar_csv.html'

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
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        nome = self.request.query_params.get('nome')
        if nome:
            qs = qs.filter(nome_paciente__icontains=nome)
        municipio = self.request.query_params.get('municipio')
        if municipio:
            qs = qs.filter(municipio__icontains=municipio)
        return qs

    def perform_create(self, serializer):
        serializer.save(criado_por=self.request.user)

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

        rows, canceladas = parse_gal_csv(csv_file.read())
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
        - cod_exame_gal novo → cria registro (status: Recebida)
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

        rows, canceladas = parse_gal_csv(csv_file.read())
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
