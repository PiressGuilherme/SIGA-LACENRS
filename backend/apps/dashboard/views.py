"""
Endpoints do Dashboard.

Todos são GET, autenticados, e recebem parâmetros de período via query string:
  ?periodo=7d | 30d | 90d | 365d
  ou ?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD

Cache de 5 minutos aplicado nos endpoints de série temporal e por operador
(onde a agregação é mais pesada). Resumo não é cacheado — precisa refletir
rapidamente mudanças do fluxo.
"""
from __future__ import annotations

import hashlib

from django.contrib.auth.decorators import login_required
from django.core.cache import cache
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.generic import TemplateView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.usuarios.permissions import IsLaboratorio, IsSupervisor

from . import services
from .periodos import resolver_intervalo


CACHE_TTL_SECONDS = 300  # 5 minutos


def _cache_key(prefix: str, intervalo) -> str:
    """Gera chave de cache determinística baseada no intervalo."""
    raw = f'{prefix}:{intervalo.inicio.isoformat()}:{intervalo.fim.isoformat()}:{intervalo.bucket}'
    return f'dashboard:{hashlib.md5(raw.encode()).hexdigest()}'


class _BaseDashboardView(APIView):
    """Base com tratamento de período compartilhado."""
    permission_classes = [IsLaboratorio]
    cache_prefix: str = ''
    use_cache: bool = True

    def get(self, request):
        intervalo = resolver_intervalo(request.query_params)

        if self.use_cache:
            key = _cache_key(self.cache_prefix, intervalo)
            cached = cache.get(key)
            if cached is not None:
                return Response(cached)

        data = self.compute(intervalo)

        if self.use_cache:
            cache.set(key, data, CACHE_TTL_SECONDS)

        return Response(data)

    def compute(self, intervalo):
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

class ResumoView(_BaseDashboardView):
    """
    GET /api/dashboard/resumo/

    Cards do topo: totais, filas, taxa de cancelamento, TAT médio.
    Não cacheado — deve refletir o estado atual da fila.
    """
    cache_prefix = 'resumo'
    use_cache = False

    def compute(self, intervalo):
        return services.resumo_geral(intervalo)


class RecebimentoView(_BaseDashboardView):
    """
    GET /api/dashboard/recebimento/?periodo=30d

    Série temporal de amostras recebidas (total / canceladas / válidas).
    """
    cache_prefix = 'recebimento'

    def compute(self, intervalo):
        return services.serie_recebimento(intervalo)


class TemposView(_BaseDashboardView):
    """
    GET /api/dashboard/tempos/?periodo=30d

    TAT por etapa: recebimento→extração, extração→PCR, PCR→resultado, total.
    """
    cache_prefix = 'tempos'

    def compute(self, intervalo):
        return services.tempos_processamento(intervalo)


class ResultadosView(_BaseDashboardView):
    """
    GET /api/dashboard/resultados/?periodo=30d

    Distribuição de resultados finais liberados + tendência de positividade.
    """
    cache_prefix = 'resultados'

    def compute(self, intervalo):
        return services.resumo_resultados(intervalo)


class OperadoresView(_BaseDashboardView):
    """
    GET /api/dashboard/operadores/?periodo=30d

    Métricas de QC por operador. Restrito a supervisores para preservar
    privacidade do time. Especialistas/técnicos veem apenas as próprias
    métricas via endpoint futuro (não implementado nesta fase).
    """
    permission_classes = [IsSupervisor]
    cache_prefix = 'operadores'

    def compute(self, intervalo):
        return services.metricas_por_operador(intervalo)


# ---------------------------------------------------------------------------
# Página web (Django template + React)
# ---------------------------------------------------------------------------

@method_decorator(login_required, name='dispatch')
class DashboardPageView(TemplateView):
    """Página do dashboard — template carrega o entry Vite."""
    template_name = 'dashboard/index.html'
