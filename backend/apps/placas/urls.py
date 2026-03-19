from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import PlacaViewSet, MontarPlacaView

router = DefaultRouter()
router.register(r'', PlacaViewSet, basename='placa')

urlpatterns = [
    path('', include(router.urls)),
]

# Páginas web (Django Templates + React)
page_urlpatterns = [
    path('placas/montar/', MontarPlacaView.as_view(), name='montar-placa-page'),
]
