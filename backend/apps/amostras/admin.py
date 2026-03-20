from django.contrib import admin
from django.db.models.expressions import RawSQL
from django.utils.html import format_html

from .models import Amostra, StatusAmostra

# Chave de ordenação numérica para codigo_interno (formato N/AA).
# LPAD garante que "10/26" > "2/26" em ordenação lexicográfica.
# Registros sem código interno ficam no final (prefixo 'z').
_CI_SORT_SQL = """
    CASE
        WHEN codigo_interno IS NULL OR codigo_interno = ''
            THEN 'z'
        ELSE LPAD(SPLIT_PART(codigo_interno, '/', 1), 10, '0')
             || '/'
             || LPAD(SPLIT_PART(codigo_interno, '/', 2), 4, '0')
    END
"""


@admin.register(Amostra)
class AmostraAdmin(admin.ModelAdmin):
    change_list_template = 'admin/amostras/amostra/change_list.html'

    list_display = (
        'codigo_interno_display', 'cod_exame_gal', 'nome_paciente',
        'status_badge', 'municipio', 'data_recebimento', 'criado_por',
    )
    list_filter = ('status', 'uf', 'municipio', 'material')
    search_fields = (
        'numero_gal', 'cod_exame_gal', 'cod_amostra_gal',
        'codigo_interno', 'nome_paciente', 'cpf', 'cns',
    )
    date_hierarchy = 'data_recebimento'
    readonly_fields = ('criado_por', 'recebido_por', 'criado_em', 'atualizado_em')
    ordering = ('-criado_em',)

    fieldsets = (
        ('Identificação GAL', {
            'fields': ('cod_exame_gal', 'numero_gal', 'cod_amostra_gal', 'codigo_interno'),
        }),
        ('Paciente', {
            'fields': ('nome_paciente', 'nome_social', 'cns', 'cpf'),
        }),
        ('Localização / Solicitação', {
            'fields': ('municipio', 'uf', 'unidade_solicitante', 'municipio_solicitante', 'material'),
        }),
        ('Datas', {
            'fields': ('data_coleta', 'data_recebimento'),
        }),
        ('Fluxo', {
            'fields': ('status', 'observacoes'),
        }),
        ('Auditoria', {
            'fields': ('criado_por', 'recebido_por', 'criado_em', 'atualizado_em'),
            'classes': ('collapse',),
        }),
    )

    STATUS_COLORS = {
        StatusAmostra.AGUARDANDO_TRIAGEM:   '#6c757d',  # cinza
        StatusAmostra.EXAME_EM_ANALISE:     '#0dcaf0',  # ciano
        StatusAmostra.ALIQUOTADA:           '#0d6efd',  # azul
        StatusAmostra.EXTRACAO:             '#fd7e14',  # laranja
        StatusAmostra.EXTRAIDA:             '#6f42c1',  # roxo
        StatusAmostra.RESULTADO:            '#20c997',  # verde-água
        StatusAmostra.RESULTADO_LIBERADO:   '#198754',  # verde
        StatusAmostra.CANCELADA:            '#dc3545',  # vermelho
        StatusAmostra.REPETICAO_SOLICITADA: '#ffc107',  # amarelo
    }

    @admin.display(description='Num. Interno', ordering='_ci_sort')
    def codigo_interno_display(self, obj):
        return obj.codigo_interno or '—'

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _ci_sort=RawSQL(_CI_SORT_SQL, [])
        )

    @admin.display(description='Status', ordering='status')
    def status_badge(self, obj):
        color = self.STATUS_COLORS.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;'
            'border-radius:4px;font-size:0.85em">{}</span>',
            color,
            obj.get_status_display(),
        )

    def save_model(self, request, obj, form, change):
        if not change:
            obj.criado_por = request.user
        super().save_model(request, obj, form, change)
