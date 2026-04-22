from django.urls import path

from .views import (
    DashboardPageView,
    OperadoresView,
    RecebimentoView,
    ResultadosView,
    ResumoView,
    TemposView,
)

urlpatterns = [
    path('resumo/', ResumoView.as_view(), name='dashboard-resumo'),
    path('recebimento/', RecebimentoView.as_view(), name='dashboard-recebimento'),
    path('tempos/', TemposView.as_view(), name='dashboard-tempos'),
    path('resultados/', ResultadosView.as_view(), name='dashboard-resultados'),
    path('operadores/', OperadoresView.as_view(), name='dashboard-operadores'),
]

# Páginas web (Django Templates + React)
page_urlpatterns = [
    path('dashboard/', DashboardPageView.as_view(), name='dashboard-page'),
]
