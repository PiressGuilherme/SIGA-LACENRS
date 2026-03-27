from django.urls import path

from .views import BuscarExamesView, ConfiguracaoView, GalWsPageView, TestarConexaoView

urlpatterns = [
    path('testar-conexao/', TestarConexaoView.as_view(), name='gal-ws-testar'),
    path('buscar-exames/',  BuscarExamesView.as_view(),  name='gal-ws-buscar-exames'),
    path('configuracao/',   ConfiguracaoView.as_view(),  name='gal-ws-configuracao'),
]

page_urlpatterns = [
    path('gal-ws/', GalWsPageView.as_view(), name='gal-ws-page'),
]
