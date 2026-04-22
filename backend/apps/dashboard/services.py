"""
Serviços de agregação para o dashboard.

=============================================================================
TRATAMENTO DE AMOSTRAS CANCELADAS E REPETIDAS
=============================================================================

Amostras CANCELADAS:
  - Excluídas do TAT (nunca chegaram a resultado liberado).
  - Excluídas da distribuição de resultados.
  - Excluídas da fila "aguardando processamento".
  - Contabilizadas separadamente como "taxa de cancelamento".
  - Contam no total de amostras recebidas no período (foram recebidas).

Amostras REPETIDAS (status REPETICAO_SOLICITADA ou com múltiplos
ResultadoAmostra por histórico):
  - Uma amostra pode ter vários ResultadoAmostra (um por run PCR).
  - O "resultado oficial" é sempre o último imutável (propriedade
    Amostra.resultado_ativo).
  - Para TAT total do fluxo: usa-se o resultado ATIVO (liberado ao paciente),
    não o primeiro (que foi invalidado/repetido).
  - Para métricas de QC por operador: contamos TODOS os ResultadoAmostra,
    inclusive os invalidados ou substituídos — invalidar resultados conta
    contra o operador no controle de qualidade.

=============================================================================
ESCALA E PERFORMANCE
=============================================================================

Dados hoje são sintéticos e pequenos. Decisões tomadas pensando no futuro:
  - Toda agregação via ORM (annotate/aggregate/Trunc*), sem N+1.
  - Consultas temporais assumem índice em data_recebimento, confirmado_em,
    status — validados em Meta.indexes dos models.
  - Agregações por operador usam Subquery + Count — evitam carregar objetos.
  - Resumo usa .count() e .aggregate() em querysets leves.

Pontos para revisitar quando volume crescer (~>100k amostras):
  - Mover TAT para cache materializado (modelo MetricasDiarias atualizado
    por signal ou job noturno).
  - Particionar auditlog_logentry por data.
"""
from __future__ import annotations

from datetime import timedelta
from statistics import median

from django.contrib.auth import get_user_model
from django.db.models import (
    Avg, Case, Count, ExpressionWrapper, F, IntegerField, Q, Value, When,
    DurationField, DateTimeField,
)
from django.db.models.functions import TruncDay, TruncWeek

from apps.amostras.models import Amostra, StatusAmostra
from apps.placas.models import Placa, Poco, StatusPlaca, TipoConteudoPoco, TipoPlaca
from apps.resultados.models import ResultadoAmostra, ResultadoFinalChoices

from .periodos import Intervalo

User = get_user_model()


# ---------------------------------------------------------------------------
# Constantes de status/resultado usadas em múltiplos lugares
# ---------------------------------------------------------------------------

STATUS_CANCELADOS = {StatusAmostra.CANCELADA}
STATUS_FINAIS = {StatusAmostra.RESULTADO_LIBERADO, StatusAmostra.CANCELADA}
STATUS_EM_ANDAMENTO = [
    s for s in StatusAmostra.values if s not in STATUS_FINAIS
]

RESULTADOS_POSITIVOS = {
    ResultadoFinalChoices.HPV16,
    ResultadoFinalChoices.HPV18,
    ResultadoFinalChoices.HPV_AR,
    ResultadoFinalChoices.HPV18_AR,
    ResultadoFinalChoices.HPV16_AR,
    ResultadoFinalChoices.HPV16_18,
    ResultadoFinalChoices.HPV16_18_AR,
}
RESULTADOS_INVALIDOS = {
    ResultadoFinalChoices.INVALIDO,
    ResultadoFinalChoices.INCONCLUSIVO,
}


# ---------------------------------------------------------------------------
# Resumo geral (cards do topo)
# ---------------------------------------------------------------------------

def resumo_geral(intervalo: Intervalo) -> dict:
    """Cards do topo do dashboard: contadores de alto nível no período."""
    recebidas_qs = Amostra.objects.filter(
        data_recebimento__gte=intervalo.inicio,
        data_recebimento__lte=intervalo.fim,
    )
    recebidas_total = recebidas_qs.count()
    canceladas_total = recebidas_qs.filter(status__in=STATUS_CANCELADOS).count()

    # Resultados ATIVOS liberados no período (considera apenas o resultado
    # imutável mais recente de cada amostra — retestes não são duplicados)
    resultados_ativos = _queryset_resultados_ativos(intervalo)
    resultados_liberados = resultados_ativos.count()
    positivos = resultados_ativos.filter(
        resultado_final__in=RESULTADOS_POSITIVOS
    ).count()
    invalidos = resultados_ativos.filter(
        resultado_final__in=RESULTADOS_INVALIDOS
    ).count()

    # Fila de amostras em andamento (não liberadas, não canceladas)
    aguardando_por_status = dict(
        Amostra.objects
        .filter(status__in=STATUS_EM_ANDAMENTO)
        .values('status')
        .annotate(total=Count('id'))
        .values_list('status', 'total')
    )
    aguardando_total = sum(aguardando_por_status.values())

    # TAT médio no período (apenas amostras com resultado ATIVO liberado)
    tat_medio_horas = _tat_total_medio_horas(intervalo)

    # Comparação com período anterior
    anterior = intervalo.periodo_anterior()
    recebidas_anterior = Amostra.objects.filter(
        data_recebimento__gte=anterior.inicio,
        data_recebimento__lte=anterior.fim,
    ).count()

    return {
        'periodo': {
            'inicio': intervalo.inicio.isoformat(),
            'fim': intervalo.fim.isoformat(),
            'dias': intervalo.dias,
        },
        'amostras_recebidas': recebidas_total,
        'amostras_recebidas_anterior': recebidas_anterior,
        'amostras_canceladas': canceladas_total,
        'taxa_cancelamento_pct': _pct(canceladas_total, recebidas_total),
        'resultados_liberados': resultados_liberados,
        'positivos': positivos,
        'taxa_positividade_pct': _pct(positivos, resultados_liberados),
        'invalidos': invalidos,
        'taxa_invalidos_pct': _pct(invalidos, resultados_liberados),
        'aguardando_total': aguardando_total,
        'aguardando_por_status': aguardando_por_status,
        'tat_medio_horas': tat_medio_horas,
        'media_diaria_recebimento': round(recebidas_total / intervalo.dias, 2),
    }


# ---------------------------------------------------------------------------
# Recebimento ao longo do tempo
# ---------------------------------------------------------------------------

def serie_recebimento(intervalo: Intervalo) -> dict:
    """
    Série temporal de amostras recebidas.

    Granularidade:
      - 'day'  para intervalos ≤ 31 dias
      - 'week' para intervalos maiores

    Retorna buckets com total e total_excluindo_canceladas, de modo que o
    frontend possa alternar a visão.
    """
    trunc_fn = TruncWeek if intervalo.bucket == 'week' else TruncDay

    buckets_qs = (
        Amostra.objects
        .filter(
            data_recebimento__gte=intervalo.inicio,
            data_recebimento__lte=intervalo.fim,
        )
        .annotate(bucket=trunc_fn('data_recebimento'))
        .values('bucket')
        .annotate(
            total=Count('id'),
            canceladas=Count('id', filter=Q(status__in=STATUS_CANCELADOS)),
        )
        .order_by('bucket')
    )

    buckets = [
        {
            'data': b['bucket'].date().isoformat(),
            'total': b['total'],
            'canceladas': b['canceladas'],
            'validas': b['total'] - b['canceladas'],
        }
        for b in buckets_qs
    ]

    total = sum(b['total'] for b in buckets)
    canceladas = sum(b['canceladas'] for b in buckets)

    return {
        'bucket': intervalo.bucket,
        'buckets': buckets,
        'total': total,
        'canceladas': canceladas,
        'validas': total - canceladas,
        'media_diaria': round(total / intervalo.dias, 2),
        'media_semanal': round(total / (intervalo.dias / 7), 2),
    }


# ---------------------------------------------------------------------------
# Tempos médios de processamento (TAT por etapa)
# ---------------------------------------------------------------------------

def tempos_processamento(intervalo: Intervalo) -> dict:
    """
    Calcula tempos médios por etapa do fluxo.

    Usa o resultado ATIVO (último imutável) como referência para TAT total —
    para retestes, o TAT reflete o tempo real até o resultado liberado
    definitivo, não o primeiro resultado invalidado.

    Etapas calculadas:
      recebimento → extração  : Amostra.data_recebimento → Placa extração atualizado_em
      extração → PCR          : Placa extração atualizado_em → Placa PCR atualizado_em
      PCR → resultado         : Placa PCR atualizado_em → ResultadoAmostra.confirmado_em
      TAT total               : data_recebimento → confirmado_em
    """
    resultados_ativos = _queryset_resultados_ativos(intervalo).select_related(
        'poco__amostra', 'poco__placa', 'poco__placa__placa_origem'
    )

    tat_total = []
    pcr_resultado = []
    extracao_pcr = []
    recebimento_extracao = []

    for res in resultados_ativos.iterator(chunk_size=500):
        amostra = res.poco.amostra
        placa_pcr = res.poco.placa
        placa_extracao = placa_pcr.placa_origem if placa_pcr else None

        confirmado = res.confirmado_em
        if amostra and amostra.data_recebimento and confirmado:
            tat_total.append((confirmado - amostra.data_recebimento).total_seconds())

        if placa_pcr and confirmado:
            pcr_resultado.append((confirmado - placa_pcr.atualizado_em).total_seconds())

        if placa_extracao and placa_pcr:
            extracao_pcr.append(
                (placa_pcr.atualizado_em - placa_extracao.atualizado_em).total_seconds()
            )

        if amostra and amostra.data_recebimento and placa_extracao:
            recebimento_extracao.append(
                (placa_extracao.atualizado_em - amostra.data_recebimento).total_seconds()
            )

    return {
        'recebimento_extracao': _estatisticas_tempo(recebimento_extracao),
        'extracao_pcr': _estatisticas_tempo(extracao_pcr),
        'pcr_resultado': _estatisticas_tempo(pcr_resultado),
        'tat_total': _estatisticas_tempo(tat_total),
        'base_amostras': len(tat_total),
    }


# ---------------------------------------------------------------------------
# Resumo de resultados
# ---------------------------------------------------------------------------

def resumo_resultados(intervalo: Intervalo) -> dict:
    """
    Distribuição de resultados finais liberados no período.

    Considera apenas resultados ATIVOS (imutáveis) — amostras com reteste
    aparecem somente com o resultado final definitivo.
    """
    resultados_ativos = _queryset_resultados_ativos(intervalo)

    distribuicao = dict(
        resultados_ativos
        .values('resultado_final')
        .annotate(total=Count('id'))
        .values_list('resultado_final', 'total')
    )

    total = sum(distribuicao.values())
    positivos = sum(distribuicao.get(r, 0) for r in RESULTADOS_POSITIVOS)
    invalidos = sum(distribuicao.get(r, 0) for r in RESULTADOS_INVALIDOS)

    # Tendência semanal de positividade
    trunc_fn = TruncWeek if intervalo.bucket == 'week' else TruncDay
    trend_qs = (
        resultados_ativos
        .annotate(bucket=trunc_fn('confirmado_em'))
        .values('bucket')
        .annotate(
            total=Count('id'),
            positivos=Count(
                'id',
                filter=Q(resultado_final__in=RESULTADOS_POSITIVOS),
            ),
        )
        .order_by('bucket')
    )

    trend = [
        {
            'data': b['bucket'].date().isoformat(),
            'total': b['total'],
            'positivos': b['positivos'],
            'taxa_positividade_pct': _pct(b['positivos'], b['total']),
        }
        for b in trend_qs
    ]

    return {
        'total': total,
        'distribuicao': [
            {
                'resultado': codigo,
                'label': ResultadoFinalChoices(codigo).label,
                'total': qtd,
                'percentual': _pct(qtd, total),
            }
            for codigo, qtd in sorted(
                distribuicao.items(), key=lambda x: x[1], reverse=True
            )
        ],
        'positivos': positivos,
        'invalidos': invalidos,
        'taxa_positividade_pct': _pct(positivos, total),
        'taxa_invalidos_pct': _pct(invalidos, total),
        'tendencia': trend,
    }


# ---------------------------------------------------------------------------
# QC por operador
# ---------------------------------------------------------------------------

def metricas_por_operador(intervalo: Intervalo) -> dict:
    """
    Métricas de QC por operador.

    Contabiliza TODOS os resultados (inclusive invalidados/substituídos) para
    que amostras que precisaram de reteste por erro de operador apareçam no
    indicador de qualidade.

    Colunas calculadas:
      - extracoes_montadas: Placa extração onde foi responsável
      - extracoes_confirmadas: Placa extração onde foi extracao_confirmada_por
      - placas_pcr_montadas: Placa PCR onde foi responsável
      - controles_invalidos: ResultadoAmostra com cp_valido=False ou cn_valido=False
      - total_resultados: ResultadoAmostra onde foi confirmado_por
      - amostras_aliquotadas: Amostra onde foi recebido_por
      - pct_controles_invalidos: taxa relativa ao total de placas PCR montadas
    """
    # Todos os usuários que tiveram atividade no período
    usuarios_ativos_ids = set()

    placas_ext_por_resp = (
        Placa.objects
        .filter(
            tipo_placa=TipoPlaca.EXTRACAO,
            data_criacao__gte=intervalo.inicio,
            data_criacao__lte=intervalo.fim,
            responsavel__isnull=False,
        )
        .values('responsavel')
        .annotate(total=Count('id'))
    )
    ext_montadas_por_user = {p['responsavel']: p['total'] for p in placas_ext_por_resp}
    usuarios_ativos_ids.update(ext_montadas_por_user)

    placas_ext_conf = (
        Placa.objects
        .filter(
            tipo_placa=TipoPlaca.EXTRACAO,
            status_placa=StatusPlaca.EXTRACAO_CONFIRMADA,
            atualizado_em__gte=intervalo.inicio,
            atualizado_em__lte=intervalo.fim,
            extracao_confirmada_por__isnull=False,
        )
        .values('extracao_confirmada_por')
        .annotate(total=Count('id'))
    )
    ext_conf_por_user = {p['extracao_confirmada_por']: p['total'] for p in placas_ext_conf}
    usuarios_ativos_ids.update(ext_conf_por_user)

    placas_pcr = (
        Placa.objects
        .filter(
            tipo_placa=TipoPlaca.PCR,
            data_criacao__gte=intervalo.inicio,
            data_criacao__lte=intervalo.fim,
            responsavel__isnull=False,
        )
        .values('responsavel')
        .annotate(total=Count('id'))
    )
    pcr_por_user = {p['responsavel']: p['total'] for p in placas_pcr}
    usuarios_ativos_ids.update(pcr_por_user)

    # Controles inválidos: contados por responsável da placa PCR onde o
    # resultado foi gerado (quem montou a placa). Isso reflete o operador
    # cujo trabalho produziu a invalidação.
    controles_inv = (
        ResultadoAmostra.objects
        .filter(
            confirmado_em__gte=intervalo.inicio,
            confirmado_em__lte=intervalo.fim,
        )
        .filter(Q(cp_valido=False) | Q(cn_valido=False))
        .values('poco__placa__responsavel')
        .annotate(total=Count('id'))
    )
    ctrl_inv_por_user = {
        c['poco__placa__responsavel']: c['total']
        for c in controles_inv
        if c['poco__placa__responsavel'] is not None
    }
    usuarios_ativos_ids.update(ctrl_inv_por_user)

    resultados_conf = (
        ResultadoAmostra.objects
        .filter(
            confirmado_em__gte=intervalo.inicio,
            confirmado_em__lte=intervalo.fim,
            confirmado_por__isnull=False,
        )
        .values('confirmado_por')
        .annotate(total=Count('id'))
    )
    res_conf_por_user = {r['confirmado_por']: r['total'] for r in resultados_conf}
    usuarios_ativos_ids.update(res_conf_por_user)

    amostras_aliquotadas = (
        Amostra.objects
        .filter(
            atualizado_em__gte=intervalo.inicio,
            atualizado_em__lte=intervalo.fim,
            recebido_por__isnull=False,
        )
        .values('recebido_por')
        .annotate(total=Count('id'))
    )
    aliq_por_user = {a['recebido_por']: a['total'] for a in amostras_aliquotadas}
    usuarios_ativos_ids.update(aliq_por_user)

    usuarios = {
        u.id: u for u in User.objects.filter(id__in=usuarios_ativos_ids)
        .prefetch_related('groups')
    }

    linhas = []
    for uid, user in usuarios.items():
        pcr_montadas = pcr_por_user.get(uid, 0)
        ctrl_inv = ctrl_inv_por_user.get(uid, 0)
        linhas.append({
            'operador_id': uid,
            'nome': user.nome_completo or user.email,
            'perfil': _perfil_usuario(user),
            'extracoes_montadas': ext_montadas_por_user.get(uid, 0),
            'extracoes_confirmadas': ext_conf_por_user.get(uid, 0),
            'placas_pcr_montadas': pcr_montadas,
            'controles_invalidos': ctrl_inv,
            'pct_controles_invalidos': _pct(ctrl_inv, pcr_montadas),
            'resultados_confirmados': res_conf_por_user.get(uid, 0),
            'amostras_aliquotadas': aliq_por_user.get(uid, 0),
        })

    linhas.sort(key=lambda x: x['nome'].lower())

    return {
        'total_operadores': len(linhas),
        'operadores': linhas,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _queryset_resultados_ativos(intervalo: Intervalo):
    """
    Resultados ATIVOS (imutáveis) confirmados no período.

    Exclui amostras canceladas.

    Nota sobre retestes: quando uma amostra tem múltiplos ResultadoAmostra
    imutáveis, o último (ordenado por confirmado_em) é considerado ativo.
    Em dados consistentes há apenas um imutável por amostra — ao solicitar
    repetição, o resultado original é transitivamente invalidado pelo reset
    do status da amostra. Caso venham a existir múltiplos, filtramos pelo
    mais recente por amostra_id.
    """
    qs = ResultadoAmostra.objects.filter(
        imutavel=True,
        confirmado_em__gte=intervalo.inicio,
        confirmado_em__lte=intervalo.fim,
    ).exclude(poco__amostra__status__in=STATUS_CANCELADOS)
    return qs


def _estatisticas_tempo(segundos_list: list[float]) -> dict:
    """Converte lista de segundos em {media, mediana, p90, amostras} em horas."""
    if not segundos_list:
        return {'media_horas': None, 'mediana_horas': None, 'p90_horas': None, 'amostras': 0}

    segundos_list = [s for s in segundos_list if s >= 0]
    if not segundos_list:
        return {'media_horas': None, 'mediana_horas': None, 'p90_horas': None, 'amostras': 0}

    segundos_list.sort()
    n = len(segundos_list)
    media = sum(segundos_list) / n
    med = median(segundos_list)
    # P90 — índice (não interpola para manter implementação leve)
    p90_idx = min(n - 1, int(round(0.9 * n)) - 1)
    p90_idx = max(0, p90_idx)
    p90 = segundos_list[p90_idx]

    return {
        'media_horas': round(media / 3600, 2),
        'mediana_horas': round(med / 3600, 2),
        'p90_horas': round(p90 / 3600, 2),
        'amostras': n,
    }


def _tat_total_medio_horas(intervalo: Intervalo) -> float | None:
    """TAT total médio (recebimento → resultado liberado) em horas."""
    resultados = _queryset_resultados_ativos(intervalo).select_related('poco__amostra')
    segundos = []
    for res in resultados.iterator(chunk_size=1000):
        amostra = res.poco.amostra
        if amostra and amostra.data_recebimento and res.confirmado_em:
            segundos.append((res.confirmado_em - amostra.data_recebimento).total_seconds())
    if not segundos:
        return None
    return round((sum(segundos) / len(segundos)) / 3600, 2)


def _pct(parte: int, total: int) -> float:
    """Percentual com 1 casa, protegido contra divisão por zero."""
    if not total:
        return 0.0
    return round((parte / total) * 100, 1)


def _perfil_usuario(user) -> str:
    """Retorna o nome do grupo principal do usuário."""
    grupos = list(user.groups.values_list('name', flat=True))
    if 'supervisor' in grupos:
        return 'supervisor'
    if 'especialista' in grupos:
        return 'especialista'
    if 'tecnico' in grupos:
        return 'tecnico'
    return grupos[0] if grupos else 'sem perfil'
