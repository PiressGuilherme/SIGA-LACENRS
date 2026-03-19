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

urlpatterns = [
    path('admin/', admin.site.urls),

    # JWT auth
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Apps — API REST
    path('api/amostras/', include('apps.amostras.urls')),
    path('api/placas/', include('apps.placas.urls')),
    path('api/resultados/', include('apps.resultados.urls')),

    # Apps — Páginas web (Django Templates + React)
    *amostras_pages,
    *placas_pages,
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns = [path('__debug__/', include(debug_toolbar.urls))] + urlpatterns
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
