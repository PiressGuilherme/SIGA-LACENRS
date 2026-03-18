from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _

from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    model = Usuario
    list_display = ('email', 'nome_completo', 'perfil', 'is_active', 'is_staff', 'criado_em')
    list_filter = ('is_active', 'is_staff', 'groups')
    search_fields = ('email', 'nome_completo')
    ordering = ('nome_completo',)

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Informações pessoais'), {'fields': ('nome_completo',)}),
        (_('Permissões'), {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        (_('Datas'), {'fields': ('last_login', 'criado_em')}),
    )
    readonly_fields = ('criado_em', 'last_login')

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'nome_completo', 'password1', 'password2', 'groups', 'is_staff', 'is_active'),
        }),
    )
