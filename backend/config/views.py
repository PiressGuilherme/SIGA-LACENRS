from django.contrib.auth.decorators import login_required
from django.db import connection
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView

from apps.amostras.models import Amostra, StatusAmostra
from apps.placas.models import Placa, StatusPlaca


def health_check(request):
    """Endpoint de saude — sem autenticacao, usado por Docker healthcheck e monitoramento."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return JsonResponse({"status": "ok", "db": "ok"})
    except Exception as e:
        return JsonResponse({"status": "error", "db": str(e)}, status=503)


@method_decorator(login_required, name='dispatch')
class HomeView(TemplateView):
    template_name = 'home.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)

        # Contadores de amostras por grupo de status
        todos = Amostra.objects.values_list('status', flat=True)
        contadores = {}
        for s in todos:
            contadores[s] = contadores.get(s, 0) + 1

        ctx['cnt'] = {
            'aguardando': (
                contadores.get(StatusAmostra.AGUARDANDO_TRIAGEM, 0) +
                contadores.get(StatusAmostra.EXAME_EM_ANALISE, 0)
            ),
            'aliquotadas': contadores.get(StatusAmostra.ALIQUOTADA, 0),
            'extracao': (
                contadores.get(StatusAmostra.EXTRACAO, 0) +
                contadores.get(StatusAmostra.EXTRAIDA, 0)
            ),
            'resultado': contadores.get(StatusAmostra.RESULTADO, 0),
            'liberadas': contadores.get(StatusAmostra.RESULTADO_LIBERADO, 0),
            'repeticao': contadores.get(StatusAmostra.REPETICAO_SOLICITADA, 0),
        }

        ctx['placas_abertas'] = Placa.objects.filter(
            status_placa=StatusPlaca.ABERTA
        ).count()
        ctx['placas_submetidas'] = Placa.objects.filter(
            status_placa=StatusPlaca.SUBMETIDA
        ).count()

        return ctx
