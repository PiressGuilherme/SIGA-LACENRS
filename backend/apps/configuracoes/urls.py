from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ConfiguracoesPageView, KitInterpretacaoViewSet, ReacaoProtocoloViewSet

router = DefaultRouter()
router.register('reacoes', ReacaoProtocoloViewSet, basename='reacao-protocolo')
router.register('kits', KitInterpretacaoViewSet, basename='kit-interpretacao')

urlpatterns = router.urls

page_urlpatterns = [
    path('configuracoes/', ConfiguracoesPageView.as_view(), name='configuracoes-page'),
]
