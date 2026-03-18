from django.conf import settings
from django.db import models

from apps.amostras.models import Amostra, StatusAmostra


class StatusPlaca(models.TextChoices):
    ABERTA = 'aberta', 'Aberta'
    SUBMETIDA = 'submetida', 'Submetida ao termociclador'
    RESULTADOS_IMPORTADOS = 'resultados_importados', 'Resultados importados'


class TipoConteudoPoco(models.TextChoices):
    AMOSTRA = 'amostra', 'Amostra'
    CONTROLE_NEGATIVO = 'cn', 'Controle Negativo'
    CONTROLE_POSITIVO = 'cp', 'Controle Positivo'
    VAZIO = 'vazio', 'Vazio'


class Placa(models.Model):
    """
    Placa de 96 poços (8 linhas × 12 colunas) utilizada nas etapas
    de extração e PCR. Uma mesma placa abrange ambas as etapas.

    Uma amostra pode estar em múltiplas placas ao longo do tempo (retestes).
    """

    protocolo = models.CharField(max_length=50, blank=True, verbose_name='Protocolo')
    responsavel = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='placas', verbose_name='Responsável',
    )
    status_placa = models.CharField(
        max_length=30, choices=StatusPlaca.choices,
        default=StatusPlaca.ABERTA, verbose_name='Status da placa',
        db_index=True,
    )
    observacoes = models.TextField(blank=True, verbose_name='Observações')
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name='Data de criação')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Placa'
        verbose_name_plural = 'Placas'
        ordering = ['-data_criacao']

    def __str__(self):
        return f'Placa #{self.pk} — {self.data_criacao.strftime("%d/%m/%Y")} ({self.get_status_placa_display()})'

    @property
    def total_amostras(self):
        return self.pocos.filter(tipo_conteudo=TipoConteudoPoco.AMOSTRA).count()

    def submeter(self):
        """Marca a placa como submetida ao termociclador e atualiza o status das amostras."""
        amostras_ids = self.pocos.filter(
            tipo_conteudo=TipoConteudoPoco.AMOSTRA,
            amostra__isnull=False,
        ).values_list('amostra_id', flat=True)

        Amostra.objects.filter(pk__in=amostras_ids).update(
            status=StatusAmostra.EM_PROCESSAMENTO
        )
        self.status_placa = StatusPlaca.SUBMETIDA
        self.save(update_fields=['status_placa', 'atualizado_em'])


class Poco(models.Model):
    """
    Poço individual de uma placa. Liga a placa a uma amostra (ou controle).

    O cruzamento com o CSV do termociclador é feito pela posição (A01, B02, etc.),
    não pelo código interno da amostra.
    """

    placa = models.ForeignKey(
        Placa, on_delete=models.CASCADE,
        related_name='pocos', verbose_name='Placa',
    )
    amostra = models.ForeignKey(
        Amostra, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='pocos', verbose_name='Amostra',
    )
    posicao = models.CharField(
        max_length=3, verbose_name='Posição',
        help_text='Formato linha+coluna: A01 … H12',
    )
    tipo_conteudo = models.CharField(
        max_length=20, choices=TipoConteudoPoco.choices,
        default=TipoConteudoPoco.AMOSTRA, verbose_name='Tipo de conteúdo',
    )

    class Meta:
        verbose_name = 'Poço'
        verbose_name_plural = 'Poços'
        unique_together = [('placa', 'posicao')]
        ordering = ['posicao']

    def __str__(self):
        amostra_label = self.amostra.codigo_interno if self.amostra else self.get_tipo_conteudo_display()
        return f'Poço {self.posicao} ({amostra_label})'
