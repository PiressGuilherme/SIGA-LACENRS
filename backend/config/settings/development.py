from .base import *  # noqa: F401, F403

DEBUG = True

ALLOWED_HOSTS = ['*']

CORS_ALLOW_ALL_ORIGINS = True

# No desenvolvimento, o DRF também aceita sessão (para o browsable API)
REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'] = [  # noqa: F405
    'rest_framework.renderers.JSONRenderer',
    'rest_framework.renderers.BrowsableAPIRenderer',
]

# Debug Toolbar
INSTALLED_APPS += ['debug_toolbar']  # noqa: F405
MIDDLEWARE += ['debug_toolbar.middleware.DebugToolbarMiddleware']  # noqa: F405
INTERNAL_IPS = ['127.0.0.1']

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Vite dev server ativo no desenvolvimento
DJANGO_VITE['default']['dev_mode'] = True  # noqa: F405
