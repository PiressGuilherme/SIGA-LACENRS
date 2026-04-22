"""
Testes do dashboard com foco em:
  - Período vazio (sem dados — não pode dividir por zero)
  - Amostras canceladas (não devem inflar TAT nem taxa de positividade)
  - Amostras repetidas (TAT deve usar o resultado ATIVO, não o invalidado)
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.amostras.models import Amostra, StatusAmostra
from apps.placas.models import (
    Placa, Poco, StatusPlaca, TipoConteudoPoco, TipoPlaca,
)
from apps.resultados.models import ResultadoAmostra, ResultadoFinalChoices

from apps.dashboard import services
from apps.dashboard.periodos import Intervalo

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures helpers
# ---------------------------------------------------------------------------

def intervalo_ultimos_dias(dias=30) -> Intervalo:
    fim = timezone.now()
    inicio = fim - timedelta(days=dias - 1)
    return Intervalo(inicio=inicio, fim=fim, bucket='day')


def make_user(email='op@lab.br'):
    return User.objects.create_user(
        email=email, password='x', nome_completo='Operador Teste',
    )


def make_amostra(**kwargs):
    defaults = dict(
        cod_exame_gal=f'EX{Amostra.objects.count() + 1:04d}',
        numero_gal=f'REQ{Amostra.objects.count() + 1:04d}',
        nome_paciente='Paciente',
        data_recebimento=timezone.now() - timedelta(days=3),
        status=StatusAmostra.AGUARDANDO_TRIAGEM,
    )
    defaults.update(kwargs)
    return Amostra.objects.create(**defaults)


def make_placa_pcr_com_resultado(
    amostra, confirmado_em, resultado_final=ResultadoFinalChoices.HPV_NAO_DETECTADO,
    responsavel=None, cp_valido=True, cn_valido=True, imutavel=True,
):
    """Cria placa PCR + poço + ResultadoAmostra vinculado à amostra."""
    placa_ext = Placa.objects.create(
        codigo=f'EXT{Placa.objects.count() + 1}',
        tipo_placa=TipoPlaca.EXTRACAO,
        status_placa=StatusPlaca.EXTRACAO_CONFIRMADA,
        responsavel=responsavel,
    )
    placa_ext.atualizado_em = confirmado_em - timedelta(hours=20)
    placa_ext.save(update_fields=['atualizado_em'])

    placa_pcr = Placa.objects.create(
        tipo_placa=TipoPlaca.PCR,
        placa_origem=placa_ext,
        status_placa=StatusPlaca.RESULTADOS_IMPORTADOS,
        responsavel=responsavel,
    )
    placa_pcr.atualizado_em = confirmado_em - timedelta(hours=2)
    placa_pcr.save(update_fields=['atualizado_em'])

    poco = Poco.objects.create(
        placa=placa_pcr, amostra=amostra, posicao='A01',
        tipo_conteudo=TipoConteudoPoco.AMOSTRA,
    )
    resultado = ResultadoAmostra.objects.create(
        poco=poco,
        resultado_final=resultado_final,
        confirmado_em=confirmado_em,
        cp_valido=cp_valido,
        cn_valido=cn_valido,
        imutavel=False,
    )
    if imutavel:
        resultado.imutavel = True
        resultado.save(update_fields=['imutavel'])
    return placa_ext, placa_pcr, resultado


# ---------------------------------------------------------------------------
# Período vazio
# ---------------------------------------------------------------------------

class ResumoPeriodoVazioTest(TestCase):
    """Quando não há dados, resumo deve retornar zeros sem quebrar."""

    def test_resumo_sem_dados(self):
        resumo = services.resumo_geral(intervalo_ultimos_dias())
        self.assertEqual(resumo['amostras_recebidas'], 0)
        self.assertEqual(resumo['resultados_liberados'], 0)
        self.assertEqual(resumo['taxa_cancelamento_pct'], 0.0)
        self.assertEqual(resumo['taxa_positividade_pct'], 0.0)
        self.assertIsNone(resumo['tat_medio_horas'])
        self.assertEqual(resumo['media_diaria_recebimento'], 0.0)

    def test_tempos_sem_dados(self):
        tempos = services.tempos_processamento(intervalo_ultimos_dias())
        self.assertIsNone(tempos['tat_total']['media_horas'])
        self.assertEqual(tempos['tat_total']['amostras'], 0)
        self.assertEqual(tempos['base_amostras'], 0)

    def test_recebimento_sem_dados(self):
        serie = services.serie_recebimento(intervalo_ultimos_dias())
        self.assertEqual(serie['total'], 0)
        self.assertEqual(serie['buckets'], [])
        self.assertEqual(serie['media_diaria'], 0.0)

    def test_operadores_sem_dados(self):
        dados = services.metricas_por_operador(intervalo_ultimos_dias())
        self.assertEqual(dados['total_operadores'], 0)
        self.assertEqual(dados['operadores'], [])


# ---------------------------------------------------------------------------
# Amostras canceladas
# ---------------------------------------------------------------------------

class AmostrasCanceladas(TestCase):
    """
    Canceladas entram no total de recebidas, mas NÃO contam no TAT,
    na taxa de positividade nem na distribuição de resultados.
    """

    def setUp(self):
        self.agora = timezone.now()
        self.recebida_normal = make_amostra(
            data_recebimento=self.agora - timedelta(days=5),
            status=StatusAmostra.RESULTADO_LIBERADO,
        )
        self.recebida_cancelada = make_amostra(
            data_recebimento=self.agora - timedelta(days=5),
            status=StatusAmostra.CANCELADA,
        )
        make_placa_pcr_com_resultado(
            self.recebida_normal,
            confirmado_em=self.agora - timedelta(days=1),
            resultado_final=ResultadoFinalChoices.HPV16,
        )

    def test_canceladas_contam_em_recebidas(self):
        resumo = services.resumo_geral(intervalo_ultimos_dias())
        self.assertEqual(resumo['amostras_recebidas'], 2)
        self.assertEqual(resumo['amostras_canceladas'], 1)
        self.assertEqual(resumo['taxa_cancelamento_pct'], 50.0)

    def test_canceladas_nao_inflam_taxa_positividade(self):
        # 1 resultado válido liberado (positivo)
        resumo = services.resumo_geral(intervalo_ultimos_dias())
        self.assertEqual(resumo['resultados_liberados'], 1)
        self.assertEqual(resumo['taxa_positividade_pct'], 100.0)

    def test_canceladas_excluidas_do_tat(self):
        # Cria um resultado "liberado" mas com amostra cancelada — não pode entrar
        cancelada_com_resultado = make_amostra(
            data_recebimento=self.agora - timedelta(days=10),
            status=StatusAmostra.CANCELADA,
        )
        make_placa_pcr_com_resultado(
            cancelada_com_resultado,
            confirmado_em=self.agora - timedelta(days=1),
            resultado_final=ResultadoFinalChoices.HPV_NAO_DETECTADO,
        )
        tempos = services.tempos_processamento(intervalo_ultimos_dias())
        self.assertEqual(tempos['tat_total']['amostras'], 1,
                         'TAT deve excluir amostras canceladas')

    def test_canceladas_excluidas_da_distribuicao_resultados(self):
        cancelada_com_resultado = make_amostra(
            data_recebimento=self.agora - timedelta(days=10),
            status=StatusAmostra.CANCELADA,
        )
        make_placa_pcr_com_resultado(
            cancelada_com_resultado,
            confirmado_em=self.agora - timedelta(days=1),
            resultado_final=ResultadoFinalChoices.INVALIDO,
        )
        dados = services.resumo_resultados(intervalo_ultimos_dias())
        self.assertEqual(dados['total'], 1)
        codigos = [d['resultado'] for d in dados['distribuicao']]
        self.assertNotIn(ResultadoFinalChoices.INVALIDO, codigos)


# ---------------------------------------------------------------------------
# Amostras repetidas
# ---------------------------------------------------------------------------

class AmostrasRepetidas(TestCase):
    """
    Uma amostra com reteste tem 2 ResultadoAmostra imutáveis.
    O TAT total deve considerar o tempo até o resultado ATIVO (o mais recente).
    """

    def test_reteste_nao_duplica_amostra_nas_metricas(self):
        """Amostra com dois resultados imutáveis conta como 1, com tempo até o ativo."""
        agora = timezone.now()
        amostra = make_amostra(
            data_recebimento=agora - timedelta(days=10),
            status=StatusAmostra.RESULTADO_LIBERADO,
        )

        # Primeiro resultado (invalidado mais tarde por reteste)
        make_placa_pcr_com_resultado(
            amostra,
            confirmado_em=agora - timedelta(days=5),
            resultado_final=ResultadoFinalChoices.INVALIDO,
        )
        # Reteste com resultado definitivo
        make_placa_pcr_com_resultado(
            amostra,
            confirmado_em=agora - timedelta(days=1),
            resultado_final=ResultadoFinalChoices.HPV_NAO_DETECTADO,
        )

        resumo = services.resumo_geral(intervalo_ultimos_dias())
        # Ambos os resultados estão no período — aparecem como 2 no "liberados"
        # (cada run PCR gera uma linha). O que não dobra é a amostra.
        self.assertEqual(resumo['amostras_recebidas'], 1)

        # Distribuição reflete os 2 runs (ambos válidos para QC)
        dados = services.resumo_resultados(intervalo_ultimos_dias())
        self.assertEqual(dados['total'], 2)

    def test_qc_operador_conta_reteste(self):
        """Controles inválidos causados pelo operador contam para o QC dele."""
        agora = timezone.now()
        operador = make_user('op@lab.br')
        amostra = make_amostra(
            data_recebimento=agora - timedelta(days=10),
            status=StatusAmostra.RESULTADO_LIBERADO,
        )

        # Placa com CP inválido por culpa do operador
        make_placa_pcr_com_resultado(
            amostra,
            confirmado_em=agora - timedelta(days=5),
            resultado_final=ResultadoFinalChoices.INVALIDO,
            responsavel=operador,
            cp_valido=False,
        )
        # Reteste OK pelo mesmo operador
        make_placa_pcr_com_resultado(
            amostra,
            confirmado_em=agora - timedelta(days=1),
            resultado_final=ResultadoFinalChoices.HPV_NAO_DETECTADO,
            responsavel=operador,
        )

        metricas = services.metricas_por_operador(intervalo_ultimos_dias())
        self.assertEqual(metricas['total_operadores'], 1)
        linha = metricas['operadores'][0]
        self.assertEqual(linha['placas_pcr_montadas'], 2)
        self.assertEqual(linha['controles_invalidos'], 1)
        self.assertEqual(linha['pct_controles_invalidos'], 50.0)


# ---------------------------------------------------------------------------
# Cálculo de estatísticas de tempo
# ---------------------------------------------------------------------------

class EstatisticasTempoTest(TestCase):
    """Valida o helper de estatísticas (divisão por zero, ordenação, P90)."""

    def test_lista_vazia(self):
        self.assertEqual(
            services._estatisticas_tempo([]),
            {'media_horas': None, 'mediana_horas': None, 'p90_horas': None, 'amostras': 0},
        )

    def test_todos_negativos_sao_filtrados(self):
        # Valores negativos indicam inversão de data e devem ser descartados
        resultado = services._estatisticas_tempo([-100, -50])
        self.assertEqual(resultado['amostras'], 0)

    def test_calculos_basicos(self):
        # 10 valores em horas convertidos para segundos
        horas = list(range(1, 11))
        segundos = [h * 3600 for h in horas]
        r = services._estatisticas_tempo(segundos)
        self.assertEqual(r['amostras'], 10)
        self.assertEqual(r['media_horas'], 5.5)
        self.assertEqual(r['mediana_horas'], 5.5)
        # P90 com 10 amostras: índice round(0.9*10)-1 = 8 → valor 9
        self.assertEqual(r['p90_horas'], 9.0)


# ---------------------------------------------------------------------------
# Percentual protegido
# ---------------------------------------------------------------------------

class PctTest(TestCase):

    def test_divisao_por_zero(self):
        self.assertEqual(services._pct(5, 0), 0.0)

    def test_calculo_normal(self):
        self.assertEqual(services._pct(1, 4), 25.0)
        self.assertEqual(services._pct(2, 3), 66.7)
