from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ResultadoAmostraViewSet, ResultadoPocoViewSet, RevisarResultadosView

router = DefaultRouter()
router.register(r'pocos', ResultadoPocoViewSet, basename='resultado-poco')
router.register(r'', ResultadoAmostraViewSet, basename='resultado-amostra')

urlpatterns = [
    path('', include(router.urls)),
]

# Páginas web (Django Templates + React)
page_urlpatterns = [
    path('resultados/revisar/', RevisarResultadosView.as_view(), name='revisar-resultados-page'),
]
