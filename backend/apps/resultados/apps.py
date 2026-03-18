from django.apps import AppConfig


class ResultadosConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.resultados'
    verbose_name = 'Resultados'

    def ready(self):
        from auditlog.registry import auditlog
        from .models import ResultadoPoco, ResultadoAmostra
        auditlog.register(ResultadoPoco)
        auditlog.register(ResultadoAmostra)
