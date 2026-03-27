"""
Cliente SOAP para o GAL WebService (Rio Grande do Sul).

Endpoint: https://gal.riograndedosul.sus.gov.br/webservice/automacao
WSDL:     https://gal.riograndedosul.sus.gov.br/webservice/automacao?wsdl

Estilo: SOAP RPC/encoded (PHP legado).
Biblioteca: zeep com transporte requests (SSL verificável ou ignorável via settings).

Uso básico:
    client = GalWsClient()
    client.autenticar()
    exames = client.buscar_exames('LACEN-RS')
"""

import logging
from typing import Any

import requests
import zeep
import zeep.helpers
from django.conf import settings

logger = logging.getLogger(__name__)

_DEFAULT_URL    = getattr(settings, 'GAL_WS_URL', 'https://gal.riograndedosul.sus.gov.br/webservice/automacao')
_DEFAULT_VERIFY = getattr(settings, 'GAL_WS_VERIFY_SSL', True)


def _get_config():
    """Lê configuração do banco (GalWsConfig) com fallback para settings."""
    try:
        from apps.gal_ws.models import GalWsConfig
        cfg = GalWsConfig.get()
        return {
            'url':    cfg.url_ws or _DEFAULT_URL,
            'verify': cfg.verificar_ssl,
            'usuario': cfg.usuario or getattr(settings, 'GAL_WS_USUARIO', ''),
            'senha':   cfg.senha   or getattr(settings, 'GAL_WS_SENHA', ''),
            'laboratorio': cfg.codigo_laboratorio,
        }
    except Exception:
        return {
            'url':    _DEFAULT_URL,
            'verify': _DEFAULT_VERIFY,
            'usuario': getattr(settings, 'GAL_WS_USUARIO', ''),
            'senha':   getattr(settings, 'GAL_WS_SENHA', ''),
            'laboratorio': '',
        }


class GalWsError(Exception):
    """Erro retornado ou gerado pelo GAL WebService."""


class GalWsClient:
    """
    Wrapper sobre o zeep para as operações do GAL WS.

    As operações disponíveis no WSDL são:
        autenticacao(usuario, senha)           → token: str
        buscarExames(laboratorio)              → soap-enc:Array
        marcarExamesEnviados(exame)            → soap-enc:Array
        gravarResultados(exames)               → soap-enc:Array
        mensagem(nome)                         → str  (diagnóstico)
        validaData()                           → str  (diagnóstico)
    """

    def __init__(self):
        self._token: str | None = None
        self._zeep: zeep.Client | None = None
        self._cfg = _get_config()

    # ------------------------------------------------------------------
    # Inicialização do cliente zeep (lazy)
    # ------------------------------------------------------------------

    def _get_zeep(self) -> zeep.Client:
        if self._zeep is None:
            url  = self._cfg['url']
            wsdl = f'{url}?wsdl'
            session = requests.Session()
            session.verify = self._cfg['verify']
            if not self._cfg['verify']:
                import urllib3
                urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            transport = zeep.transports.Transport(session=session, timeout=30)
            self._zeep = zeep.Client(wsdl, transport=transport)
            logger.debug('GalWsClient: zeep inicializado, endpoint=%s', url)
        return self._zeep

    def _call(self, operacao: str, **kwargs) -> Any:
        """Chama uma operação SOAP e retorna o resultado bruto do zeep."""
        client = self._get_zeep()
        try:
            resultado = getattr(client.service, operacao)(**kwargs)
            logger.debug('GAL WS %s(%s) → %r', operacao, kwargs, resultado)
            return resultado
        except zeep.exceptions.Fault as exc:
            raise GalWsError(f'SOAP Fault em {operacao}: {exc}') from exc
        except Exception as exc:
            raise GalWsError(f'Erro de transporte em {operacao}: {exc}') from exc

    # ------------------------------------------------------------------
    # Operações públicas
    # ------------------------------------------------------------------

    def autenticar(self, usuario: str | None = None, senha: str | None = None) -> str:
        """
        Autentica no GAL WS e armazena o token internamente.

        Se usuario/senha forem None, lê de settings.GAL_WS_USUARIO e GAL_WS_SENHA.
        Retorna o token.
        """
        usuario = usuario or self._cfg['usuario']
        senha   = senha   or self._cfg['senha']

        if not usuario or not senha:
            raise GalWsError(
                'Credenciais não configuradas. '
                'Defina GAL_WS_USUARIO e GAL_WS_SENHA no .env.'
            )

        token = self._call('autenticacao', usuario=usuario, senha=senha)

        if not token:
            raise GalWsError('autenticacao retornou token vazio — credenciais inválidas?')

        self._token = str(token)
        logger.info('GalWsClient: autenticado com sucesso, token=%s…', self._token[:8])
        return self._token

    def buscar_exames(self, laboratorio: str) -> list[dict]:
        """
        Busca exames pendentes de envio para o laboratório.

        Retorna uma lista de dicts com os campos retornados pelo GAL.
        O shape exato depende do retorno real do WS (descoberto em runtime).
        """
        resultado = self._call('buscarExames', laboratorio=laboratorio)
        return _normalizar_array(resultado)

    def marcar_exames_enviados(self, exame: str) -> list[dict]:
        """
        Marca um exame como enviado ao equipamento.

        O parâmetro `exame` provavelmente é o código/ID do exame retornado
        por buscarExames — a confirmar com o schema real do WS.
        """
        resultado = self._call('marcarExamesEnviados', exame=exame)
        return _normalizar_array(resultado)

    def gravar_resultados(self, exames: Any) -> list[dict]:
        """
        Envia resultados de volta ao GAL.

        O parâmetro `exames` deve ser um soap-enc:Array com os resultados.
        O schema exato será determinado após inspecionar buscarExames em produção.
        """
        resultado = self._call('gravarResultados', exames=exames)
        return _normalizar_array(resultado)

    # Operações de diagnóstico (úteis para testar conectividade)

    def ping_mensagem(self, nome: str = 'SIGA-LACEN') -> str:
        """Chama operação 'mensagem' — diagnóstico de conectividade."""
        return str(self._call('mensagem', nome=nome))

    def valida_data(self) -> str:
        """Chama operação 'validaData' — diagnóstico de data/hora do servidor GAL."""
        return str(self._call('validaData'))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalizar_array(raw: Any) -> list[dict]:
    """
    Converte o retorno zeep (soap-enc:Array, dict, list ou None) para list[dict].

    Como o WSDL não define o schema interno dos arrays, o zeep retorna
    tipos genéricos. Usamos zeep.helpers.serialize_object para converter
    em estruturas Python nativas.
    """
    if raw is None:
        return []

    serializado = zeep.helpers.serialize_object(raw, target_cls=dict)

    if isinstance(serializado, list):
        return serializado
    if isinstance(serializado, dict):
        # Às vezes o zeep embala em {'item': [...]} ou similar
        for key in ('item', 'items', 'return', 'resultado'):
            if key in serializado:
                val = serializado[key]
                return val if isinstance(val, list) else [val]
        # Único objeto retornado
        return [serializado]

    logger.warning('GalWsClient: retorno inesperado após serialize_object: %r', serializado)
    return []
