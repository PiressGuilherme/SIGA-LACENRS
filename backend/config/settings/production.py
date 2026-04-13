from .base import *  # noqa: F401, F403

# HTTPS é terminado pelo Nginx; não redirecionar no Django
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = False

# ---------------------------------------------------------------------------
# Cookies — CSRF + Session
# ---------------------------------------------------------------------------

SESSION_COOKIE_SECURE = True        # Cookie apenas via HTTPS
SESSION_COOKIE_HTTPONLY = True      # JavaScript não consegue acessar (exceto Vite/React)
SESSION_COOKIE_SAMESITE = 'Strict'  # Cookie não enviado em requisições cross-site

CSRF_COOKIE_SECURE = True           # Cookie apenas via HTTPS
CSRF_COOKIE_HTTPONLY = False        # ⚠️ INTENCIONAL: JavaScript precisa ler para enviar no header
CSRF_COOKIE_SAMESITE = 'Strict'     # Cookie não enviado em requisições cross-site

# CSRF_COOKIE_HTTPONLY = False é SEGURO porque:
# 1. JavaScript só consegue ler cookie do mesmo domínio (Same-Origin Policy)
# 2. Token é aleatório e validado servidor-side
# 3. Token deve ser enviado no header X-CSRFToken (requisito do Django)
# 4. Um site malicioso não consegue ler este cookie, nem enviar requisições customizadas

# ---------------------------------------------------------------------------
# Headers de Segurança
# ---------------------------------------------------------------------------

SECURE_BROWSER_XSS_FILTER = True     # IE/Edge: X-XSS-Protection: 1; mode=block
SECURE_CONTENT_TYPE_NOSNIFF = True   # X-Content-Type-Options: nosniff
X_FRAME_OPTIONS = 'DENY'             # X-Frame-Options: DENY (clickjacking)

# ⚠️ Para produção com domínio real, adicionar:
# SECURE_HSTS_SECONDS = 31536000      # Strict-Transport-Security por 1 ano
# SECURE_HSTS_INCLUDE_SUBDOMAINS = True
# SECURE_HSTS_PRELOAD = True          # Incluir em HSTS preload list do navegador
