"""
Resolução de intervalos de tempo para os endpoints do dashboard.

Aceita:
  periodo=7d | 30d | 90d | 365d   (atalhos)
  data_inicio=YYYY-MM-DD & data_fim=YYYY-MM-DD   (intervalo custom)

Retorna sempre um par (inicio, fim) no timezone do Django.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from django.utils import timezone
from rest_framework.exceptions import ValidationError


ATALHOS_VALIDOS = {'7d': 7, '30d': 30, '90d': 90, '365d': 365}
DEFAULT_PERIODO = '30d'


@dataclass(frozen=True)
class Intervalo:
    inicio: datetime
    fim: datetime
    # Bucket sugerido para agregação temporal: 'day' ou 'week'
    bucket: str

    @property
    def dias(self) -> int:
        return max(1, (self.fim.date() - self.inicio.date()).days + 1)

    def periodo_anterior(self) -> 'Intervalo':
        """Retorna o intervalo imediatamente anterior com a mesma duração, para comparação."""
        duracao = self.fim - self.inicio
        fim_anterior = self.inicio
        inicio_anterior = fim_anterior - duracao
        return Intervalo(inicio=inicio_anterior, fim=fim_anterior, bucket=self.bucket)


def _parse_data(valor: str, campo: str) -> date:
    try:
        return datetime.strptime(valor, '%Y-%m-%d').date()
    except (TypeError, ValueError):
        raise ValidationError({campo: f'Data inválida. Use o formato YYYY-MM-DD.'})


def resolver_intervalo(query_params) -> Intervalo:
    """
    Resolve o intervalo a partir dos query params do request.

    Prioridade: data_inicio + data_fim > periodo (atalho) > DEFAULT_PERIODO.
    """
    tz = timezone.get_current_timezone()
    data_inicio = query_params.get('data_inicio')
    data_fim = query_params.get('data_fim')

    if data_inicio or data_fim:
        if not (data_inicio and data_fim):
            raise ValidationError(
                'Informe data_inicio e data_fim juntos, ou use apenas periodo.'
            )
        di = _parse_data(data_inicio, 'data_inicio')
        df = _parse_data(data_fim, 'data_fim')
        if di > df:
            raise ValidationError('data_inicio não pode ser posterior a data_fim.')
        inicio = datetime.combine(di, datetime.min.time(), tzinfo=tz)
        fim = datetime.combine(df, datetime.max.time(), tzinfo=tz)
    else:
        periodo = query_params.get('periodo', DEFAULT_PERIODO)
        if periodo not in ATALHOS_VALIDOS:
            raise ValidationError(
                {'periodo': f'Valor inválido. Use um de: {", ".join(ATALHOS_VALIDOS)}.'}
            )
        dias = ATALHOS_VALIDOS[periodo]
        agora = timezone.now()
        fim = agora
        inicio = (agora - timedelta(days=dias - 1)).replace(hour=0, minute=0, second=0, microsecond=0)

    bucket = 'day' if (fim.date() - inicio.date()).days <= 31 else 'week'
    return Intervalo(inicio=inicio, fim=fim, bucket=bucket)
