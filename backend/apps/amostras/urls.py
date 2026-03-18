from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import AmostraViewSet, ImportarCSVView

router = DefaultRouter()
router.register(r'', AmostraViewSet, basename='amostra')

urlpatterns = [
    path('', include(router.urls)),
]

# Páginas web (Django Templates + React)
page_urlpatterns = [
    path('amostras/importar/', ImportarCSVView.as_view(), name='importar-csv-page'),
]
