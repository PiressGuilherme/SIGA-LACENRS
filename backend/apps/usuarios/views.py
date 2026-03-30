from django.contrib.auth import get_user_model
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

        return Response(_tokens_response(user))


class ValidarCrachaView(APIView):
    """
    GET /api/auth/validar-cracha/?codigo=<numero_cracha>

    Valida um número de crachá e retorna os dados básicos do operador.
    Usado pelos módulos de aliquotagem e extração para identificar o operador
    antes de cada transição de status.

    Requer autenticação (a sessão já deve estar ativa).
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
        return Response({
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
