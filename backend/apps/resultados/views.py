from rest_framework import viewsets, permissions

from .models import ResultadoAmostra, ResultadoPoco
from .serializers import ResultadoAmostraSerializer, ResultadoPocoSerializer

# ----------------------------------------------------------------------------
# Implementados na Fase 4
# ----------------------------------------------------------------------------


class ResultadoAmostraViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para ResultadoAmostra (leitura).
    Fase 4 adiciona: importar/ (parser CFX), confirmar/, genotipagem.
    """
    queryset = ResultadoAmostra.objects.select_related(
        'poco__amostra', 'confirmado_por'
    ).all()
    serializer_class = ResultadoAmostraSerializer
    permission_classes = [permissions.IsAuthenticated]
