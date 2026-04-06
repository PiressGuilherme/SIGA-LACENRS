from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.db.models.expressions import RawSQL
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView
from rest_framework import status, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from apps.usuarios.permissions import IsTecnico, IsEspecialista, IsSupervisor, IsLaboratorio
from .models import Amostra, StatusAmostra
from .serializers import AmostraSerializer
from .utils import parse_gal_file


# Status válidos para aliquotagem
_STATUS_ALIQUOTAGEM_VALIDOS = {
    StatusAmostra.AGUARDANDO_TRIAGEM,
    StatusAmostra.EXAME_EM_ANALISE,
}


@method_decorator(login_required, name='dispatch')
class ImportarCSVView(TemplateView):
    """Página de importação de CSV do GAL (React via django-vite)."""
    template_name = 'amostras/importar_csv.html'


@method_decorator(login_required, name='dispatch')
class AliquotagemView(TemplateView):
    """Página de aliquotagem de amostras (React via django-vite)."""
    template_name = 'amostras/aliquotagem.html'


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
    queryset = Amostra.objects.select_related('criado_por', 'recebido_por').all()
    serializer_class = AmostraSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        # Escrita manual (criar/editar/excluir): apenas supervisor
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsSupervisor()]
        # Import CSV e recebimento: qualquer perfil de laboratório (técnico, especialista, supervisor)
        if self.action in ('preview_csv', 'importar_csv', 'receber'):
            return [IsLaboratorio()]
        # list, retrieve, filtros: qualquer autenticado
        return [permissions.IsAuthenticated()]

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
        ordering = self.request.query_params.get('ordering', 'codigo_interno')
        field = ordering.lstrip('-')
        if field in self._ORDENAVEIS:
            if field == 'codigo_interno':
                # Ordenação numérica N/AA (ex: 2/26 antes de 10/26)
                qs = qs.annotate(_ci_sort=RawSQL(self._CI_SORT_SQL, []))
                qs = qs.order_by('-_ci_sort' if ordering.startswith('-') else '_ci_sort')
            else:
                qs = qs.order_by(ordering)

        return qs

    _ORDENAVEIS = {
        'codigo_interno', 'nome_paciente', 'status',
        'municipio', 'data_recebimento', 'criado_em',
    }

    _CI_SORT_SQL = """
        CASE
            WHEN codigo_interno IS NULL OR codigo_interno = ''
                THEN 'z'
            ELSE LPAD(SPLIT_PART(codigo_interno, '/', 1), 10, '0')
                 || '/'
                 || LPAD(SPLIT_PART(codigo_interno, '/', 2), 4, '0')
        END
    """

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

    def _build_existentes_maps(self, rows: list[dict]) -> tuple[dict, dict]:
        """
        Retorna dois dicts de Amostras já existentes no banco:
          by_exame   = {cod_exame_gal: Amostra}
          by_amostra = {cod_amostra_gal: Amostra}

        O segundo dict permite detectar duplicatas cross-formato: quando o CSV
        usa um relatório diferente (ex: formato BMH vs clássico), o cod_exame_gal
        muda, mas cod_amostra_gal é estável e identifica a mesma amostra física.
        """
        cod_exames  = [r['cod_exame_gal']  for r in rows if r.get('cod_exame_gal')]
        cod_amostras = [r['cod_amostra_gal'] for r in rows if r.get('cod_amostra_gal')]

        qs = Amostra.objects.filter(
            Q(cod_exame_gal__in=cod_exames) | Q(cod_amostra_gal__in=cod_amostras)
        ).only('id', 'cod_exame_gal', 'cod_amostra_gal', 'codigo_interno', 'data_recebimento')

        by_exame   = {a.cod_exame_gal: a for a in qs}
        by_amostra = {a.cod_amostra_gal: a for a in qs if a.cod_amostra_gal}
        return by_exame, by_amostra

    def _detectar_updates(self, existente: Amostra, row: dict,
                          via_cod_amostra: bool = False) -> dict:
        """
        Retorna campos que podem ser atualizados (estavam vazios, agora chegaram).

        Se via_cod_amostra=True (match cross-formato), também inclui cod_exame_gal
        para migrar o identificador antigo para o novo formato.
        """
        updates = {}
        for campo in CAMPOS_ATUALIZAVEIS:
            valor_existente = getattr(existente, campo, None)
            valor_novo = row.get(campo)
            if not valor_existente and valor_novo:
                updates[campo] = valor_novo

        # Cross-formato: migra o identificador para o novo valor
        if via_cod_amostra:
            novo_cod = row.get('cod_exame_gal', '')
            if novo_cod and existente.cod_exame_gal != novo_cod:
                updates['cod_exame_gal'] = novo_cod

        return updates

    # ------------------------------------------------------------------
    # Endpoint de aliquotagem
    # ------------------------------------------------------------------

    @action(detail=False, methods=['post'], url_path='receber')
    def receber(self, request):
        """
        Confirma a aliquotagem de uma amostra via leitura de código.

        Body: { "codigo": "<valor escaneado>", "numero_cracha": "<crachá do operador>" }

        - numero_cracha obrigatório para não-superusuários.
        - Busca por: codigo_interno, cod_amostra_gal ou cod_exame_gal (nessa ordem).
        - Valida que a amostra está em status Aguardando Triagem ou Exame em Análise.
        - Atualiza o status para Aliquotada; registra o operador em recebido_por.
        """
        from django.contrib.auth import get_user_model
        User = get_user_model()

        codigo = (request.data.get('codigo') or '').strip()
        if not codigo:
            return Response(
                {'erro': 'Nenhum código informado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validação de crachá
        numero_cracha = (request.data.get('numero_cracha') or '').strip()
        if numero_cracha:
            try:
                operador = User.objects.get(numero_cracha=numero_cracha, is_active=True)
            except User.DoesNotExist:
                return Response(
                    {'erro': 'Crachá não reconhecido ou operador inativo.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        elif request.user.is_superuser:
            operador = request.user
        else:
            return Response(
                {'erro': 'Informe o código do crachá do operador para confirmar a aliquotagem.'},
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

        if amostra.status not in _STATUS_ALIQUOTAGEM_VALIDOS:
            return Response(
                {
                    'erro': (
                        f'Amostra está com status "{amostra.get_status_display()}" '
                        f'e não pode ser aliquotada.'
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        from auditlog.context import set_actor
        amostra.status = StatusAmostra.ALIQUOTADA
        amostra.recebido_por = operador
        with set_actor(operador):
            amostra.save(update_fields=['status', 'recebido_por', 'atualizado_em'])

        return Response(
            {
                'sucesso': True,
                'amostra': AmostraSerializer(amostra).data,
            },
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # Histórico (auditlog)
    # ------------------------------------------------------------------

    @staticmethod
    def _actor_name(actor):
        """Retorna o nome legível do actor de um LogEntry."""
        if not actor:
            return None
        if hasattr(actor, 'nome_completo') and actor.nome_completo:
            return actor.nome_completo
        return actor.get_full_name() or actor.email

    @action(detail=True, methods=['get'], url_path='historico')
    def historico(self, request, pk=None):
        """
        Retorna o histórico de mudanças de status da amostra baseado no auditlog.

        Cada entrada contém:
          - timestamp, de, para (status legível), actor (nome do operador)
        """
        from auditlog.models import LogEntry
        from django.contrib.contenttypes.models import ContentType

        amostra = self.get_object()
        ct = ContentType.objects.get_for_model(Amostra)

        entries = (
            LogEntry.objects
            .filter(content_type=ct, object_pk=str(amostra.pk))
            .select_related('actor')
            .order_by('timestamp')
        )

        status_labels = dict(StatusAmostra.choices)

        timeline = []
        for entry in entries:
            try:
                changes = entry.changes_dict or {}
            except Exception:
                changes = {}

            if 'status' in changes:
                old_val, new_val = changes['status']
                timeline.append({
                    'timestamp': entry.timestamp.isoformat(),
                    'de': status_labels.get(old_val, old_val),
                    'para': status_labels.get(new_val, new_val),
                    'de_valor': old_val,
                    'para_valor': new_val,
                    'actor': self._actor_name(entry.actor),
                })
            elif entry.action == 0:  # CREATE
                initial_status = changes.get('status', [None, None])
                status_val = initial_status[1] if isinstance(initial_status, list) else None
                if status_val:
                    timeline.append({
                        'timestamp': entry.timestamp.isoformat(),
                        'de': None,
                        'para': status_labels.get(status_val, status_val),
                        'de_valor': None,
                        'para_valor': status_val,
                        'actor': self._actor_name(entry.actor),
                        'tipo': 'criacao',
                    })

        return Response(timeline)

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
            rows, canceladas, colunas_csv = parse_gal_file(csv_file.read(), csv_file.name)
        except (ValueError, Exception) as exc:
            return Response({'erro': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        aviso = None
        if not rows:
            aviso = (
                f'Nenhuma amostra detectada. '
                f'Colunas presentes no arquivo: {", ".join(colunas_csv[:12])}.'
            )

        by_exame, by_amostra = self._build_existentes_maps(rows)

        result = []
        for row in rows:
            cod_exame  = row.get('cod_exame_gal', '')
            cod_amostra = row.get('cod_amostra_gal', '')

            if cod_exame in by_exame:
                existente = by_exame[cod_exame]
                updates = self._detectar_updates(existente, row)
            elif cod_amostra and cod_amostra in by_amostra:
                # Match cross-formato: mesma amostra física, identificador diferente
                existente = by_amostra[cod_amostra]
                updates = self._detectar_updates(existente, row, via_cod_amostra=True)
            else:
                existente = None
                updates = {}

            if existente is not None:
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

        payload = {
            'total':        len(result) + canceladas,
            'novos':        sum(1 for r in result if r['_status_importacao'] == 'novo'),
            'atualizaveis': sum(1 for r in result if r['_status_importacao'] == 'atualizavel'),
            'duplicados':   sum(1 for r in result if r['_status_importacao'] == 'duplicado'),
            'cancelados':   canceladas,
            'amostras':     result,
        }
        if aviso:
            payload['aviso'] = aviso
        return Response(payload)

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
            rows, canceladas, _ = parse_gal_file(csv_file.read(), csv_file.name)
        except (ValueError, Exception) as exc:
            return Response({'erro': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        by_exame, by_amostra = self._build_existentes_maps(rows)

        importadas = []
        atualizadas = []
        duplicadas = []
        erros = []

        for row in rows:
            cod_exame   = row.get('cod_exame_gal', '')
            cod_amostra = row.get('cod_amostra_gal', '')

            # Remover campos auxiliares antes de criar/atualizar o model
            row.pop('_status_exame_gal', None)

            # Localizar registro existente (por cod_exame_gal ou fallback por cod_amostra_gal)
            if cod_exame in by_exame:
                existente = by_exame[cod_exame]
                updates = self._detectar_updates(existente, row)
                filtro = {'cod_exame_gal': cod_exame}
            elif cod_amostra and cod_amostra in by_amostra:
                existente = by_amostra[cod_amostra]
                updates = self._detectar_updates(existente, row, via_cod_amostra=True)
                filtro = {'cod_amostra_gal': cod_amostra}
            else:
                existente = None

            if existente is not None:
                if updates:
                    try:
                        Amostra.objects.filter(**filtro).update(**updates)
                        atualizadas.append({'cod_exame_gal': cod_exame, 'campos': list(updates.keys())})
                    except Exception as exc:
                        erros.append({'cod_exame_gal': cod_exame, 'erro': str(exc)})
                else:
                    duplicadas.append(cod_exame)
                continue

            try:
                amostra = Amostra(**row)
                amostra.criado_por = request.user
                amostra.full_clean()
                amostra.save()
                importadas.append(cod_exame)
            except Exception as exc:
                erros.append({'cod_exame_gal': cod_exame, 'erro': str(exc)})

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
