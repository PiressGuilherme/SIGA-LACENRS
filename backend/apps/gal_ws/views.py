"""
Views do GAL WebService — página de configuração + endpoints de diagnóstico.
"""

import logging

from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .client import GalWsClient, GalWsError
from .models import GalWsConfig

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Página web (Django Template + React)
# ---------------------------------------------------------------------------

@method_decorator(login_required, name='dispatch')
class GalWsPageView(TemplateView):
    template_name = 'gal_ws/configurar.html'

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_staff:
            from django.http import HttpResponseForbidden
            return HttpResponseForbidden('Acesso restrito a supervisores.')
        return super().dispatch(request, *args, **kwargs)


# ---------------------------------------------------------------------------
# API — Configuração
# ---------------------------------------------------------------------------

class ConfiguracaoView(APIView):
    """
    GET  /api/gal-ws/configuracao/  → lê configuração atual (senha mascarada)
    POST /api/gal-ws/configuracao/  → salva configuração
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        cfg = GalWsConfig.get()
        return Response({
            'usuario':           cfg.usuario,
            'senha_configurada': bool(cfg.senha),
            'codigo_laboratorio': cfg.codigo_laboratorio,
            'url_ws':            cfg.url_ws,
            'verificar_ssl':     cfg.verificar_ssl,
        })

    def post(self, request):
        cfg = GalWsConfig.get()
        data = request.data

        cfg.usuario            = data.get('usuario', cfg.usuario)
        cfg.codigo_laboratorio = data.get('codigo_laboratorio', cfg.codigo_laboratorio)
        cfg.url_ws             = data.get('url_ws', cfg.url_ws)
        cfg.verificar_ssl      = bool(data.get('verificar_ssl', cfg.verificar_ssl))

        # Só atualiza a senha se vier preenchida (campo opcional no form)
        nova_senha = data.get('senha', '').strip()
        if nova_senha:
            cfg.senha = nova_senha

        cfg.save()
        return Response({'ok': True, 'mensagem': 'Configuração salva.'})


# ---------------------------------------------------------------------------
# API — Diagnóstico / testes
# ---------------------------------------------------------------------------

class TestarConexaoView(APIView):
    """
    POST /api/gal-ws/testar-conexao/
    Testa autenticação + mensagem + validaData.
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        client = GalWsClient()
        cfg = client._cfg

        if not cfg['usuario'] or not cfg['senha']:
            return Response(
                {'erro': 'Usuário e senha não configurados.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        resultado = {}

        try:
            token = client.autenticar()
            resultado['autenticacao'] = 'ok'
            resultado['token_prefixo'] = token[:8] + '…'
        except GalWsError as exc:
            return Response(
                {'erro': str(exc), 'etapa': 'autenticacao'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        try:
            resultado['mensagem'] = client.ping_mensagem()
        except GalWsError as exc:
            resultado['mensagem_erro'] = str(exc)

        try:
            resultado['valida_data'] = client.valida_data()
        except GalWsError as exc:
            resultado['valida_data_erro'] = str(exc)

        return Response(resultado)


class BuscarExamesView(APIView):
    """
    POST /api/gal-ws/buscar-exames/
    Body: { "laboratorio": "LACEN-RS" }  (opcional — usa config salva se omitido)
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        client = GalWsClient()
        laboratorio = (
            request.data.get('laboratorio', '').strip()
            or client._cfg.get('laboratorio', '')
        )
        if not laboratorio:
            return Response(
                {'erro': 'Campo "laboratorio" obrigatório (ou configure o código no painel).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            client.autenticar()
        except GalWsError as exc:
            return Response({'erro': str(exc), 'etapa': 'autenticacao'},
                            status=status.HTTP_502_BAD_GATEWAY)

        try:
            exames = client.buscar_exames(laboratorio)
        except GalWsError as exc:
            return Response({'erro': str(exc), 'etapa': 'buscarExames'},
                            status=status.HTTP_502_BAD_GATEWAY)

        return Response({
            'laboratorio': laboratorio,
            'total': len(exames),
            'exames': exames,
        })
