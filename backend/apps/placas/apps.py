from django.apps import AppConfig


class PlacasConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.placas'
    verbose_name = 'Placas'

    def ready(self):
        from auditlog.registry import auditlog
        from .models import Placa, Poco
        auditlog.register(Placa)
        auditlog.register(Poco)
