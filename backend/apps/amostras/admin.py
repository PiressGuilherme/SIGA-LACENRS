from django.contrib import admin
from django.utils.html import format_html

from .models import Amostra, StatusAmostra


@admin.register(Amostra)
class AmostraAdmin(admin.ModelAdmin):
    list_display = (
        'codigo_interno', 'cod_exame_gal', 'nome_paciente',
        'status_badge', 'municipio', 'data_recebimento', 'criado_por',
    )
    list_filter = ('status', 'uf', 'municipio', 'material')
    search_fields = (
        'numero_gal', 'cod_exame_gal', 'cod_amostra_gal',
        'codigo_interno', 'nome_paciente', 'cpf', 'cns',
    )
    date_hierarchy = 'data_recebimento'
    readonly_fields = ('criado_por', 'criado_em', 'atualizado_em')
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
            'fields': ('criado_por', 'criado_em', 'atualizado_em'),
            'classes': ('collapse',),
        }),
    )

    STATUS_COLORS = {
        StatusAmostra.RECEBIDA:            '#6c757d',
        StatusAmostra.ALIQUOTADA:          '#0d6efd',
        StatusAmostra.EM_PROCESSAMENTO:    '#fd7e14',
        StatusAmostra.AMPLIFICADA:         '#6f42c1',
        StatusAmostra.RESULTADO_LIBERADO:  '#198754',
        StatusAmostra.CANCELADA:           '#dc3545',
        StatusAmostra.REPETICAO_SOLICITADA: '#ffc107',
    }

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
