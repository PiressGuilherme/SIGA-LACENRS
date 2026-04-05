"""
Utilitários compartilhados entre apps do SIGA-LACENRS.
"""
from contextlib import contextmanager

from django.contrib.auth import get_user_model


User = get_user_model()


@contextmanager
def noop_ctx():
    """Context manager vazio — usado quando não há operador para o set_actor."""
    yield


def resolver_operador(request):
    """
    Resolve o operador a partir de numero_cracha ou fallback para request.user.

    Retorna tupla (operador, actor_ctx, erro).
    - operador: instância de Usuario
    - actor_ctx: context manager para auditlog (set_actor ou noop_ctx)
    - erro: mensagem de erro ou None
    """
    from auditlog.context import set_actor

    numero_cracha = ''
    # Suporte para FormData (multipart) e JSON
    if hasattr(request.data, 'get'):
        numero_cracha = (request.data.get('numero_cracha') or '').strip()

    if numero_cracha:
        try:
            operador = User.objects.get(numero_cracha=numero_cracha, is_active=True)
        except User.DoesNotExist:
            return request.user, set_actor(request.user), None
        return operador, set_actor(operador), None

    return request.user, set_actor(request.user), None