"""
Permissões por grupo para o SIGA-LACEN.

Grupos disponíveis (definidos em fixtures/grupos_iniciais.json):
  tecnico      — Consulta, Import CSV, Aliquotagem, Extração, Montagem PCR
                 (NÃO pode submeter ao termociclador nem acessar Resultados)
  especialista — Todas as permissões do Técnico + Termociclador + Resultados
  supervisor   — is_staff + is_superuser, acesso total ao Django Admin

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


class IsTecnico(BasePermission):
    """Perfil: tecnico, especialista, supervisor.

    Técnico tem acesso a: Consulta, Import CSV, Aliquotagem, Extração, Montagem PCR.
    NÃO pode submeter ao termociclador nem acessar Resultados.
    """
    message = 'Acesso restrito ao perfil Técnico, Especialista ou Supervisor.'

    def has_permission(self, request, view):
        return _in_groups(request.user, 'tecnico', 'especialista', 'supervisor')


class IsEspecialista(BasePermission):
    """Perfil: especialista, supervisor.

    Especialista tem acesso a todas as operações laboratoriais incluindo
    termociclador e resultados, mas não tem privilégios de administração.
    """
    message = 'Acesso restrito ao perfil Especialista ou Supervisor.'

    def has_permission(self, request, view):
        return _in_groups(request.user, 'especialista', 'supervisor')


class IsSupervisor(BasePermission):
    """Perfil: supervisor (somente).

    Supervisor tem is_staff + is_superuser e acesso total ao sistema.
    """
    message = 'Acesso restrito ao perfil Supervisor.'

    def has_permission(self, request, view):
        return _in_groups(request.user, 'supervisor')


class IsLaboratorio(BasePermission):
    """Qualquer perfil de laboratório (tecnico, especialista, supervisor)."""
    message = 'Acesso restrito a usuários com perfil de laboratório.'

    def has_permission(self, request, view):
        return _in_groups(request.user, 'tecnico', 'especialista', 'supervisor')