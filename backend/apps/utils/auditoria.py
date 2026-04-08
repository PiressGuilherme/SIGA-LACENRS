from contextlib import contextmanager

from django.contrib.auth import get_user_model

User = get_user_model()


@contextmanager
def noop_ctx():
    yield


def resolver_operador(request):
    """Resolve o operador a partir de numero_cracha ou fallback para request.user."""
    from auditlog.context import set_actor
    numero_cracha = (request.data.get('numero_cracha') or '').strip()
    if numero_cracha:
        try:
            operador = User.objects.get(numero_cracha=numero_cracha, is_active=True)
        except User.DoesNotExist:
            return None, None, 'Crachá não reconhecido ou operador inativo.'
        return operador, set_actor(operador), None
    return request.user, set_actor(request.user), None
