from rest_framework import viewsets, permissions

from .models import Amostra
from .serializers import AmostraSerializer

# ----------------------------------------------------------------------------
# Implementados na Fase 2
# ----------------------------------------------------------------------------


class AmostraViewSet(viewsets.ModelViewSet):
    """
    ViewSet completo para Amostra.
    Fase 2 adiciona: importar-csv/, histórico/, filtros avançados.
    """
    queryset = Amostra.objects.select_related('criado_por').all()
    serializer_class = AmostraSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        return qs
