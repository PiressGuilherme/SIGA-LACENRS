from rest_framework import viewsets, permissions

from .models import Placa, Poco
from .serializers import PlacaSerializer, PocoSerializer

# ----------------------------------------------------------------------------
# Implementados na Fase 3
# ----------------------------------------------------------------------------


class PlacaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Placa.
    Fase 3 adiciona: endpoint pocos/, submeter/, exportar-pdf/.
    """
    queryset = Placa.objects.prefetch_related('pocos__amostra').all()
    serializer_class = PlacaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(responsavel=self.request.user)


class PocoViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Poco (poços individuais de uma placa).
    Fase 3 adiciona: bulk create/update para o espelho de placa React.
    """
    queryset = Poco.objects.select_related('placa', 'amostra').all()
    serializer_class = PocoSerializer
    permission_classes = [permissions.IsAuthenticated]
