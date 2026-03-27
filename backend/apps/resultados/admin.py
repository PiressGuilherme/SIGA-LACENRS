from django.contrib import admin
from django.utils.html import format_html

from .models import ResultadoPoco, ResultadoAmostra, ResultadoFinalChoices


@admin.register(ResultadoPoco)
class ResultadoPocoAdmin(admin.ModelAdmin):
    list_display = ('poco', 'canal', 'cq', 'interpretacao', 'interpretacao_efetiva')
    list_filter = ('canal', 'interpretacao', 'interpretacao_manual')
    search_fields = ('poco__posicao', 'poco__amostra__codigo_interno')
    readonly_fields = ('poco', 'canal', 'cq', 'interpretacao')

    def has_add_permission(self, request):
        return False  # Criados apenas pelo parser

    @admin.display(description='Interp. efetiva')
    def interpretacao_efetiva(self, obj):
        return obj.interpretacao_efetiva


@admin.register(ResultadoAmostra)
class ResultadoAmostraAdmin(admin.ModelAdmin):
    list_display = (
        'amostra_codigo', 'ci_resultado', 'hpv16_resultado',
        'hpv18_resultado', 'hpvar_resultado', 'resultado_final_badge',
        'imutavel', 'confirmado_em', 'confirmado_por',
    )
    list_filter = ('resultado_final', 'imutavel', 'ci_resultado')
    search_fields = ('poco__amostra__codigo_interno', 'poco__amostra__numero_gal')
    readonly_fields = ('poco', 'confirmado_em', 'confirmado_por', 'imutavel')

    # Verde para negativo, vermelho para qualquer HPV detectado, amarelo para exceções
    RESULTADO_COLORS = {
        ResultadoFinalChoices.HPV_NAO_DETECTADO: '#198754',
        ResultadoFinalChoices.HPV16:             '#dc3545',
        ResultadoFinalChoices.HPV18:             '#dc3545',
        ResultadoFinalChoices.HPV_AR:            '#dc3545',
        ResultadoFinalChoices.HPV18_AR:          '#dc3545',
        ResultadoFinalChoices.HPV16_AR:          '#dc3545',
        ResultadoFinalChoices.HPV16_18:          '#dc3545',
        ResultadoFinalChoices.HPV16_18_AR:       '#dc3545',
        ResultadoFinalChoices.INVALIDO:          '#ffc107',
        ResultadoFinalChoices.INCONCLUSIVO:      '#fd7e14',
        ResultadoFinalChoices.PENDENTE:          '#6c757d',
    }

    def has_add_permission(self, request):
        return False  # Criados apenas pelo parser

    @admin.display(description='Amostra', ordering='poco__amostra__codigo_interno')
    def amostra_codigo(self, obj):
        return obj.poco.amostra.codigo_interno if obj.poco.amostra else '—'

    @admin.display(description='Resultado final', ordering='resultado_final')
    def resultado_final_badge(self, obj):
        color = self.RESULTADO_COLORS.get(obj.resultado_final, '#6c757d')
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;border-radius:4px;font-size:0.85em">{}</span>',
            color,
            obj.get_resultado_final_display(),
        )
