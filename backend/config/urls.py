from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from apps.amostras.urls import page_urlpatterns as amostras_pages
from apps.placas.urls import page_urlpatterns as placas_pages
from apps.resultados.urls import page_urlpatterns as resultados_pages
from apps.gal_ws.urls import page_urlpatterns as gal_ws_pages
from apps.configuracoes.urls import page_urlpatterns as configuracoes_pages
from apps.usuarios.urls import api_urlpatterns as auth_api, page_urlpatterns as auth_pages
from config.views import HomeView

urlpatterns = [
    path('', HomeView.as_view(), name='home'),
    path('admin/', admin.site.urls),

    # Auth — login dedicado
    path('api/auth/', include((auth_api, 'auth'))),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Apps — API REST
    path('api/amostras/', include('apps.amostras.urls')),
    path('api/placas/', include('apps.placas.urls')),
    path('api/resultados/', include('apps.resultados.urls')),
    path('api/gal-ws/', include('apps.gal_ws.urls')),
    path('api/configuracoes/', include('apps.configuracoes.urls')),

    # Apps — Páginas web (Django Templates + React)
    *auth_pages,
    *amostras_pages,
    *placas_pages,
    *resultados_pages,
    *gal_ws_pages,
    *configuracoes_pages,
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns = [path('__debug__/', include(debug_toolbar.urls))] + urlpatterns
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
