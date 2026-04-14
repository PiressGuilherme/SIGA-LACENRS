from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class StatusAmostra(models.TextChoices):
    # Statuses refletidos do GAL (definidos pelo sistema de origem)
    AGUARDANDO_TRIAGEM   = 'aguardando_triagem',   'Aguardando Triagem'
    EXAME_EM_ANALISE     = 'exame_em_analise',     'Exame em Análise'
    # Statuses internos do LACEN (definidos pelo fluxo laboratorial)
    ALIQUOTADA           = 'aliquotada',           'Aliquotada'
    EXTRACAO             = 'extracao',             'Extração'
    EXTRAIDA             = 'extraida',             'Extraída'
    PCR                  = 'pcr',                  'PCR em andamento'
    RESULTADO            = 'resultado',            'Resultado'
    RESULTADO_LIBERADO   = 'resultado_liberado',   'Resultado Liberado'
    # Exceções
    CANCELADA            = 'cancelada',            'Cancelada'
    REPETICAO_SOLICITADA = 'repeticao_solicitada', 'Repetição Solicitada'


# ---------------------------------------------------------------------------
# State machine — transições de status permitidas
# ---------------------------------------------------------------------------
TRANSICOES_VALIDAS: dict[str, set[str]] = {
    StatusAmostra.AGUARDANDO_TRIAGEM: {
        StatusAmostra.EXAME_EM_ANALISE,
        StatusAmostra.ALIQUOTADA,
        StatusAmostra.CANCELADA,
    },
    StatusAmostra.EXAME_EM_ANALISE: {
        StatusAmostra.ALIQUOTADA,
        StatusAmostra.CANCELADA,
    },
    StatusAmostra.ALIQUOTADA: {
        StatusAmostra.EXTRACAO,
        StatusAmostra.CANCELADA,
    },
    StatusAmostra.EXTRACAO: {
        StatusAmostra.ALIQUOTADA,            # placa de extração excluída
        StatusAmostra.EXTRAIDA,              # scan confirma extração
        StatusAmostra.CANCELADA,
    },
    StatusAmostra.EXTRAIDA: {
        StatusAmostra.PCR,                       # amostra adicionada a placa PCR
        StatusAmostra.CANCELADA,
    },
    StatusAmostra.PCR: {
        StatusAmostra.EXTRAIDA,                  # placa PCR excluída
        StatusAmostra.RESULTADO,                 # CSV do termociclador importado
        StatusAmostra.CANCELADA,
    },
    StatusAmostra.RESULTADO: {
        StatusAmostra.RESULTADO_LIBERADO,
        StatusAmostra.REPETICAO_SOLICITADA,
        StatusAmostra.CANCELADA,
    },
    StatusAmostra.RESULTADO_LIBERADO: {
        StatusAmostra.CANCELADA,
    },
    StatusAmostra.REPETICAO_SOLICITADA: {
        StatusAmostra.PCR,                   # amostra adicionada a nova placa PCR
        StatusAmostra.CANCELADA,
    },
    StatusAmostra.CANCELADA: set(),          # status terminal
}


def validar_transicao(status_atual: str, novo_status: str) -> None:
    """
    Levanta ValidationError se a transição de status_atual → novo_status
    não for permitida pelo fluxo laboratorial.

    Use antes de qualquer chamada a save() que altere o campo status.
    Operações bulk (Amostra.objects.filter().update()) não chamam este helper
    automaticamente — cabe à view garantir a validação quando necessário.
    """
    permitidas = TRANSICOES_VALIDAS.get(status_atual, set())
    if novo_status not in permitidas:
        label_atual = StatusAmostra(status_atual).label if status_atual in StatusAmostra.values else status_atual
        label_novo  = StatusAmostra(novo_status).label  if novo_status  in StatusAmostra.values else novo_status
        raise ValidationError(
            f'Transição de status inválida: "{label_atual}" → "{label_novo}".'
        )


class Amostra(models.Model):
    """
    Representa uma amostra de paciente recebida para análise de HPV.

    Identificadores do GAL:
      - cod_exame_gal   : código único do exame no GAL (coluna "Cód. Exame")
      - numero_gal      : número da requisição do paciente no GAL (coluna "Requisição")
      - cod_amostra_gal : código da amostra física no GAL (coluna "Cód. Amostra")
      - codigo_interno  : rastreamento interno LACEN no formato N/AA
                          (ex: 1/26 = 1ª amostra do ano 2026). Importado do CSV
                          quando disponível (coluna "Num.Interno"); preenchido
                          manualmente quando ausente.

    Ciclo de vida:
      - Uma Requisição GAL corresponde a UM paciente.
      - Importação do CSV GAL → status inicial reflete o Status Exame do GAL
        (Aguardando Triagem ou Exame em Análise).
      - No Módulo de Recebimento, após aliquotagem confirmada por scanner → Aliquotada.
      - Adicionada a placa de extração e placa salva → Extração.
      - Código da placa escaneado → Extraída.
      - Adicionada a placa PCR e placa salva → PCR.
      - CSV do termociclador importado → Resultado.
      - Resultado publicado no GAL → Resultado Liberado.
      - Em reteste, a MESMA alíquota é reutilizada (não há nova aliquotagem).
      - Novo ciclo anual → nova Requisição GAL → nova Amostra mãe → nova alíquota.
    """

    # ------------------------------------------------------------------
    # Identificadores GAL
    # ------------------------------------------------------------------
    cod_exame_gal = models.CharField(
        max_length=20, unique=True, db_index=True,
        verbose_name='Cód. Exame GAL',
        help_text='Identificador único do exame no GAL (coluna "Cód. Exame").',
    )
    numero_gal = models.CharField(
        max_length=30, db_index=True,
        verbose_name='Número GAL (Requisição)',
        help_text='Número da requisição do paciente no GAL.',
    )
    cod_amostra_gal = models.CharField(
        max_length=20, blank=True,
        verbose_name='Cód. Amostra GAL',
        help_text='Código da amostra física no GAL (coluna "Cód. Amostra").',
    )
    codigo_interno = models.CharField(
        max_length=20, unique=True, null=True, blank=True,
        verbose_name='Código interno',
        help_text='Formato N/AA atribuído pelo LACEN (ex: 1/26). '
                  'Importado do GAL quando disponível; preenchido manualmente caso ausente.',
    )

    # ------------------------------------------------------------------
    # Dados do paciente
    # ------------------------------------------------------------------
    nome_paciente = models.CharField(max_length=200, verbose_name='Paciente')
    nome_social = models.CharField(max_length=200, blank=True, verbose_name='Nome Social')
    cns = models.CharField(max_length=25, blank=True, verbose_name='CNS')
    cpf = models.CharField(max_length=14, blank=True, verbose_name='CPF')

    # ------------------------------------------------------------------
    # Dados geográficos / solicitação
    # ------------------------------------------------------------------
    municipio = models.CharField(max_length=100, blank=True, verbose_name='Município de Residência')
    uf = models.CharField(max_length=2, blank=True, verbose_name='UF')
    unidade_solicitante = models.CharField(max_length=200, blank=True, verbose_name='Unidade Solicitante')
    municipio_solicitante = models.CharField(max_length=100, blank=True, verbose_name='Município Solicitante')
    material = models.CharField(max_length=100, blank=True, verbose_name='Material')

    # ------------------------------------------------------------------
    # Datas (vêm do CSV GAL; podem estar ausentes para amostras não recebidas)
    # ------------------------------------------------------------------
    data_coleta = models.DateTimeField(
        null=True, blank=True,
        verbose_name='Data de Cadastro/Coleta (GAL)',
        help_text='Coluna "Dt. Cadastro" do CSV GAL.',
    )
    data_recebimento = models.DateTimeField(
        null=True, blank=True,
        verbose_name='Data de Recebimento',
        help_text='Coluna "Dt. Recebimento" do CSV GAL.',
    )

    # ------------------------------------------------------------------
    # Fluxo interno
    # ------------------------------------------------------------------
    status = models.CharField(
        max_length=30,
        choices=StatusAmostra.choices,
        default=StatusAmostra.AGUARDANDO_TRIAGEM,
        verbose_name='Status',
        db_index=True,
    )
    observacoes = models.TextField(blank=True, verbose_name='Observações')

    # ------------------------------------------------------------------
    # Auditoria
    # ------------------------------------------------------------------
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='amostras_criadas', verbose_name='Criado por',
    )
    recebido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='amostras_recebidas', verbose_name='Recebido por',
        help_text='Operador que confirmou o recebimento/aliquotagem.',
    )
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Amostra'
        verbose_name_plural = 'Amostras'
        ordering = ['-criado_em']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['numero_gal']),
            models.Index(fields=['cod_exame_gal']),
            models.Index(fields=['codigo_interno']),
        ]

    def __str__(self):
        codigo = self.codigo_interno or self.cod_exame_gal
        return f'{codigo} — {self.nome_paciente} (GAL: {self.numero_gal})'

    @property
    def resultado_ativo(self):
        """Retorna o último ResultadoAmostra confirmado (imutável) desta amostra."""
        return (
            self.pocos
            .filter(resultado_amostra__imutavel=True)
            .select_related('resultado_amostra')
            .order_by('-resultado_amostra__confirmado_em')
            .values_list('resultado_amostra', flat=True)
            .first()
        )
