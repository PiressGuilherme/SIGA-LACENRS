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


class SexoChoices(models.TextChoices):
    MASCULINO = 'M', 'Masculino'
    FEMININO = 'F', 'Feminino'
    INDETERMINADO = 'I', 'Indeterminado'


class Amostra(models.Model):
    """
    Representa uma amostra de paciente recebida para análise de HPV.

    Identificadores:
      - numero_gal     : código único do sistema GAL (vínculo anônimo ao paciente)
      - codigo_interno : código do laboratório no formato N/AA (ex: 1/26)

    Uma amostra pode participar de múltiplas placas ao longo do tempo (retestes).
    O resultado ativo é sempre o último ResultadoAmostra com imutavel=True.
    """

    # Identificadores
    numero_gal = models.CharField(
        max_length=50, unique=True, verbose_name='Número GAL',
        help_text='Identificador único do sistema GAL — anonimizado.',
    )
    codigo_interno = models.CharField(
        max_length=20, unique=True, verbose_name='Código interno',
        help_text='Formato N/AA (ex: 1/26 = 1ª amostra do ano 2026).',
    )

    # Datas
    data_coleta = models.DateField(
        null=True, blank=True, verbose_name='Data de coleta',
        help_text='Preenchida a partir do CSV do GAL.',
    )
    data_recebimento = models.DateField(verbose_name='Data de recebimento')

    # Dados clínicos (sem dado nominativo — conformidade LGPD)
    sexo = models.CharField(
        max_length=1, choices=SexoChoices.choices,
        null=True, blank=True, verbose_name='Sexo',
    )
    idade = models.PositiveIntegerField(null=True, blank=True, verbose_name='Idade')
    municipio = models.CharField(max_length=100, blank=True, verbose_name='Município')
    cid = models.CharField(max_length=20, blank=True, verbose_name='CID')

    # Fluxo
    status = models.CharField(
        max_length=30,
        choices=StatusAmostra.choices,
        default=StatusAmostra.RECEBIDA,
        verbose_name='Status',
        db_index=True,
    )
    observacoes = models.TextField(blank=True, verbose_name='Observações')

    # Auditoria
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
            models.Index(fields=['codigo_interno']),
        ]

    def __str__(self):
        return f'{self.codigo_interno} (GAL: {self.numero_gal})'

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
