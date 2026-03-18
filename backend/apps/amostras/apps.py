from django.apps import AppConfig


class AmostrasConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.amostras'
    verbose_name = 'Amostras'

    def ready(self):
        from auditlog.registry import auditlog
        from .models import Amostra
        auditlog.register(Amostra)
