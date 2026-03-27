from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import PlacaViewSet, MontarPlacaView, PlacaPCRView

router = DefaultRouter()
router.register(r'', PlacaViewSet, basename='placa')

urlpatterns = [
    path('', include(router.urls)),
]

# Páginas web (Django Templates + React)
page_urlpatterns = [
    path('placas/extracao/', MontarPlacaView.as_view(), name='extracao-page'),
    path('placas/pcr/',      PlacaPCRView.as_view(),    name='pcr-page'),
    # manter alias antigo para não quebrar bookmarks
    path('placas/montar/',   MontarPlacaView.as_view(), name='montar-placa-page'),
]
