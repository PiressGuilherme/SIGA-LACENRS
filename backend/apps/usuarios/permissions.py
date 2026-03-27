"""
Permissões por grupo para o SIGA-LACEN.

Grupos disponíveis (definidos em fixtures/grupos_iniciais.json):
  extracao   — Import CSV GAL, recebimento, montagem e confirmação de placa de extração
  pcr        — Montagem placa PCR, import resultado, revisão e confirmação
  supervisor — Todas as operações acima + edição manual + auditoria

Superusuários Django têm acesso irrestrito.
"""
from rest_framework.permissions import BasePermission


def _in_groups(user, *group_names: str) -> bool:
    """Retorna True se o usuário pertence a pelo menos um dos grupos informados."""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return user.groups.filter(name__in=group_names).exists()


class IsExtracaoOuSupervisor(BasePermission):
    """Perfis: extracao, supervisor."""
    message = 'Acesso restrito ao perfil Extração ou Supervisor.'

    def has_permission(self, request, view):
        return _in_groups(request.user, 'extracao', 'supervisor')


class IsPCROuSupervisor(BasePermission):
    """Perfis: pcr, supervisor."""
    message = 'Acesso restrito ao perfil PCR ou Supervisor.'

    def has_permission(self, request, view):
        return _in_groups(request.user, 'pcr', 'supervisor')


class IsSupervisor(BasePermission):
    """Perfil: supervisor (somente)."""
    message = 'Acesso restrito ao perfil Supervisor.'

    def has_permission(self, request, view):
        return _in_groups(request.user, 'supervisor')


class IsLaboratorio(BasePermission):
    """Qualquer perfil de laboratório (extracao, pcr ou supervisor)."""
    message = 'Acesso restrito a usuários com perfil de laboratório.'

    def has_permission(self, request, view):
        return _in_groups(request.user, 'extracao', 'pcr', 'supervisor')
