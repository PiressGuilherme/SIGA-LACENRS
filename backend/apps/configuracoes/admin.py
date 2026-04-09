from django.contrib import admin

from .models import KitInterpretacao, PlacaGrupoReacao, ReacaoProtocolo, ReacaoReagente


class ReacaoReagenteInline(admin.TabularInline):
    model = ReacaoReagente
    extra = 1


@admin.register(ReacaoProtocolo)
class ReacaoProtocoloAdmin(admin.ModelAdmin):
    list_display = ['nome', 'ativo', 'atualizado_em']
    list_filter = ['ativo']
    inlines = [ReacaoReagenteInline]


@admin.register(KitInterpretacao)
class KitInterpretacaoAdmin(admin.ModelAdmin):
    list_display = ['nome', 'ativo', 'cq_controle_max', 'cq_amostra_ci_max', 'cq_amostra_hpv_max']
    list_filter = ['ativo']


@admin.register(PlacaGrupoReacao)
class PlacaGrupoReacaoAdmin(admin.ModelAdmin):
    list_display = ['placa', 'grupo', 'protocolo']
    list_filter = ['grupo']
