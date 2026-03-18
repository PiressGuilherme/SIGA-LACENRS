from django.urls import path, include
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
# ViewSets serão registrados aqui na Fase 4

urlpatterns = [
    path('', include(router.urls)),
]
