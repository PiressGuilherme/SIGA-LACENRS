from django.conf import settings
from django.db import models


class StatusAmostra(models.TextChoices):
    RECEBIDA = 'recebida', 'Recebida'
    ALIQUOTADA = 'aliquotada', 'Aliquotada'
    EM_PROCESSAMENTO = 'em_processamento', 'Em processamento'
    AMPLIFICADA = 'amplificada', 'Amplificada'
    RESULTADO_LIBERADO = 'resultado_liberado', 'Resultado liberado'
    CANCELADA = 'cancelada', 'Cancelada'
    REPETICAO_SOLICITADA = 'repeticao_solicitada', 'Repetição Solicitada'


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
      - No LACEN, cada importação cria uma Amostra mãe (status: Recebida).
      - A Amostra mãe é aliquotada UMA VEZ → status: Aliquotada.
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
        default=StatusAmostra.RECEBIDA,
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
