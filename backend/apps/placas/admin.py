from django.contrib import admin

from .models import Placa, Poco, TipoConteudoPoco


class PocoInline(admin.TabularInline):
    model = Poco
    extra = 0
    fields = ('posicao', 'tipo_conteudo', 'amostra')
    autocomplete_fields = ('amostra',)
    ordering = ('posicao',)


@admin.register(Placa)
class PlacaAdmin(admin.ModelAdmin):
    list_display = ('codigo', '__str__', 'protocolo', 'responsavel', 'status_placa', 'total_amostras', 'data_criacao')
    list_filter = ('status_placa', 'data_criacao')
    search_fields = ('codigo', 'protocolo', 'responsavel__email', 'responsavel__nome_completo')
    readonly_fields = ('codigo', 'data_criacao', 'atualizado_em', 'total_amostras')
    inlines = [PocoInline]

    fieldsets = (
        (None, {'fields': ('codigo', 'protocolo', 'responsavel', 'status_placa', 'observacoes')}),
        ('Auditoria', {'fields': ('data_criacao', 'atualizado_em'), 'classes': ('collapse',)}),
    )

    def save_model(self, request, obj, form, change):
        if not change:
            obj.responsavel = request.user
        super().save_model(request, obj, form, change)


@admin.register(Poco)
class PocoAdmin(admin.ModelAdmin):
    list_display = ('posicao', 'placa', 'tipo_conteudo', 'amostra')
    list_filter = ('tipo_conteudo', 'placa')
    search_fields = ('posicao', 'amostra__codigo_interno', 'amostra__numero_gal')
    autocomplete_fields = ('amostra',)
