from django.contrib.auth import get_user_model, login as django_login, logout as django_logout
from django.views.generic import TemplateView
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class LoginRateThrottle(AnonRateThrottle):
    """Limita tentativas de login a 10/minuto por IP."""
    rate = '10/minute'


class LoginPageView(TemplateView):
    """Página de login (template Django + React)."""
    template_name = 'usuarios/login.html'


class LoginEmailView(APIView):
    """
    POST /api/auth/login/
    Body: { "email": "...", "senha": "..." }
    Retorna access + refresh tokens e dados básicos do usuário.
    """
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        senha = request.data.get('senha', '')

        if not email or not senha:
            return Response(
                {'erro': 'E-mail e senha são obrigatórios.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'erro': 'Credenciais inválidas.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.check_password(senha):
            return Response(
                {'erro': 'Credenciais inválidas.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return Response(
                {'erro': 'Usuário inativo. Contate o administrador.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        user.backend = 'django.contrib.auth.backends.ModelBackend'
        django_login(request, user)
        return Response(_tokens_response(user))


class LoginCrachaView(APIView):
    """
    POST /api/auth/login-cracha/
    Body: { "numero_cracha": "..." }
    Autentica pelo número do crachá sem necessidade de senha.
    """
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        numero = request.data.get('numero_cracha', '').strip()

        if not numero:
            return Response(
                {'erro': 'Número do crachá não informado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(numero_cracha=numero, is_active=True)
        except User.DoesNotExist:
            return Response(
                {'erro': 'Crachá não reconhecido ou usuário inativo.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user.backend = 'django.contrib.auth.backends.ModelBackend'
        django_login(request, user)
        return Response(_tokens_response(user))


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Encerra a sessão Django e invalida o refresh token JWT.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        django_logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ValidarCrachaView(APIView):
    """
    GET /api/auth/validar-cracha/?codigo=<numero_cracha>[&grupos=<g1,g2>]

    Valida um crachá, faz switch completo da sessão para o operador e retorna
    tokens JWT + dados do usuário.

    Parâmetro opcional `grupos`: lista separada por vírgula dos grupos exigidos
    pelo módulo (ex: grupos=especialista,supervisor). Se informado e o operador
    não pertencer a nenhum deles, retorna 403.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        codigo = request.query_params.get('codigo', '').strip()
        if not codigo:
            return Response(
                {'erro': 'Parâmetro "codigo" obrigatório.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(numero_cracha=codigo, is_active=True)
        except User.DoesNotExist:
            return Response(
                {'erro': 'Crachá não reconhecido ou operador inativo.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Verifica grupos requeridos pelo módulo
        grupos_param = request.query_params.get('grupos', '').strip()
        if grupos_param and not user.is_superuser:
            grupos_requeridos = [g.strip() for g in grupos_param.split(',') if g.strip()]
            if grupos_requeridos and not user.groups.filter(name__in=grupos_requeridos).exists():
                nomes = ', '.join(g.capitalize() for g in grupos_requeridos)
                return Response(
                    {'erro': f'Perfil insuficiente para este módulo. Requer: {nomes}.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        # Switch completo de sessão Django
        user.backend = 'django.contrib.auth.backends.ModelBackend'
        django_login(request, user)

        # Gera novos tokens JWT para o operador validado
        refresh = RefreshToken.for_user(user)
        return Response({
            'access':  str(refresh.access_token),
            'refresh': str(refresh),
            'usuario': {
                'id':            user.pk,
                'nome_completo': user.nome_completo,
                'email':         user.email,
                'perfil':        user.perfil,
                'is_staff':      user.is_staff,
            },
            # Campos diretos para compatibilidade com o callback onValidado
            'id':            user.pk,
            'nome_completo': user.nome_completo,
            'perfil':        user.perfil,
        })


def _tokens_response(user):
    """Gera tokens JWT e retorna payload padronizado."""
    refresh = RefreshToken.for_user(user)
    return {
        'access':  str(refresh.access_token),
        'refresh': str(refresh),
        'usuario': {
            'id':           user.pk,
            'nome_completo': user.nome_completo,
            'email':         user.email,
            'perfil':        user.perfil,
            'is_staff':      user.is_staff,
        },
    }
