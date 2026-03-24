from django.contrib import admin

from .models import GalWsConfig


@admin.register(GalWsConfig)
class GalWsConfigAdmin(admin.ModelAdmin):
    list_display = ('url_ws', 'usuario', 'codigo_laboratorio', 'verificar_ssl', 'atualizado_em')
    fields = ('usuario', 'senha', 'codigo_laboratorio', 'url_ws', 'verificar_ssl')
