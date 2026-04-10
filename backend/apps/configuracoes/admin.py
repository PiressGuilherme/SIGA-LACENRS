from django.contrib import admin

from .models import (
    KitAlvo, KitInterpretacao, PlacaGrupoReacao,
    ReacaoProtocolo, ReacaoReagente, RegraInterpretacao, RegrasLimiar,
)


class ReacaoReagenteInline(admin.TabularInline):
    model = ReacaoReagente
    extra = 1


@admin.register(ReacaoProtocolo)
class ReacaoProtocoloAdmin(admin.ModelAdmin):
    list_display = ['nome', 'ativo', 'atualizado_em']
    list_filter = ['ativo']
    inlines = [ReacaoReagenteInline]


class RegrasLimiarInline(admin.TabularInline):
    model = RegrasLimiar
    extra = 1
    fields = ['contexto', 'operador', 'ct_limiar']


class KitAlvoInline(admin.StackedInline):
    model = KitAlvo
    extra = 0
    fields = ['nome', 'tipo_alvo', 'canal', 'ordem']
    show_change_link = True


class RegraInterpretacaoInline(admin.TabularInline):
    model = RegraInterpretacao
    extra = 0
    fields = ['prioridade', 'resultado_label', 'resultado_codigo', 'tipo_resultado', 'condicoes']


@admin.register(KitAlvo)
class KitAlvoAdmin(admin.ModelAdmin):
    list_display = ['nome', 'kit', 'tipo_alvo', 'canal', 'ordem']
    list_filter = ['kit', 'tipo_alvo']
    inlines = [RegrasLimiarInline]


@admin.register(KitInterpretacao)
class KitInterpretacaoAdmin(admin.ModelAdmin):
    list_display = ['nome', 'ativo', 'cq_controle_max', 'cq_amostra_ci_max', 'cq_amostra_hpv_max']
    list_filter = ['ativo']
    inlines = [KitAlvoInline, RegraInterpretacaoInline]


@admin.register(PlacaGrupoReacao)
class PlacaGrupoReacaoAdmin(admin.ModelAdmin):
    list_display = ['placa', 'grupo', 'protocolo']
    list_filter = ['grupo']
