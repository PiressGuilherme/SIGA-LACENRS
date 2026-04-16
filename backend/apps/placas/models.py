from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

from apps.utils.auditoria import noop_ctx as _noop_ctx
from apps.amostras.models import Amostra, StatusAmostra


class TipoPlaca(models.TextChoices):
    EXTRACAO = 'extracao', 'Extração'
    PCR      = 'pcr',      'PCR'


class StatusPlaca(models.TextChoices):
    ABERTA               = 'aberta',               'Aberta'
    EXTRACAO_CONFIRMADA  = 'extracao_confirmada',  'Extração confirmada'   # só extração
    SUBMETIDA            = 'submetida',             'Submetida ao termociclador'  # só PCR
    RESULTADOS_IMPORTADOS = 'resultados_importados', 'Resultados importados'       # só PCR


class TipoConteudoPoco(models.TextChoices):
    AMOSTRA            = 'amostra', 'Amostra'
    CONTROLE_NEGATIVO  = 'cn',      'Controle Negativo'
    CONTROLE_POSITIVO  = 'cp',      'Controle Positivo'
    VAZIO              = 'vazio',   'Vazio'


class Placa(models.Model):
    """
    Placa de 96 poços (8×12) utilizada nas etapas de extração e PCR.

    tipo_placa = 'extracao': placa física usada para extração de DNA; é congelada
                             e rastreada no BD. Ciclo: ABERTA → EXTRACAO_CONFIRMADA.
    tipo_placa = 'pcr':      placa que vai ao termociclador. Pode ser criada a partir
                             de uma placa de extração (placa_origem) ou do zero.
                             Ciclo: ABERTA → SUBMETIDA → RESULTADOS_IMPORTADOS.
    """

    codigo = models.CharField(
        max_length=20, unique=True, blank=True,
        verbose_name='Código da Placa',
        help_text='Extração: informado pelo usuário ao criar a placa. PCR: gerado automaticamente no formato HPVp{DDMMAA}-{N} (ex: HPVp010426-1).',
        db_index=True,
    )
    tipo_placa = models.CharField(
        max_length=10, choices=TipoPlaca.choices,
        default=TipoPlaca.EXTRACAO, verbose_name='Tipo de placa',
        db_index=True,
    )
    placa_origem = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='placas_pcr_derivadas',
        verbose_name='Placa de extração de origem',
        help_text='Preenchido somente em placas PCR criadas a partir de uma extração.',
    )
    protocolo = models.CharField(max_length=50, blank=True, verbose_name='Protocolo')
    responsavel = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='placas', verbose_name='Responsável',
    )
    extracao_confirmada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='extracoes_confirmadas',
        verbose_name='Extração confirmada por',
        help_text='Operador que confirmou a extração (scan do crachá).',
    )
    status_placa = models.CharField(
        max_length=30, choices=StatusPlaca.choices,
        default=StatusPlaca.ABERTA, verbose_name='Status da placa',
        db_index=True,
    )
    kit_extracao = models.ForeignKey(
        'configuracoes.KitExtracao', on_delete=models.SET_NULL,
        null=True, blank=True,
        verbose_name='Kit de extração',
        help_text='Kit de extração usado nesta placa (aparece no mapa de trabalho).',
    )
    kit_interpretacao = models.ForeignKey(
        'configuracoes.KitInterpretacao', on_delete=models.SET_NULL,
        null=True, blank=True,
        verbose_name='Kit de interpretação',
        help_text='Kit usado para interpretação dos resultados desta placa.',
    )
    observacoes = models.TextField(blank=True, verbose_name='Observações')
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name='Data de criação')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Placa'
        verbose_name_plural = 'Placas'
        ordering = ['-data_criacao']

    def save(self, *args, **kwargs):
        if not self.codigo:
            if self.tipo_placa == TipoPlaca.EXTRACAO:
                raise ValidationError({'codigo': 'Código é obrigatório para placas de extração.'})
            self.codigo = self._gerar_codigo_pcr()
        super().save(*args, **kwargs)

    def _gerar_codigo_pcr(self):
        """Gera código único para placa PCR: HPVp{DDMMAA}-{N}."""
        agora = timezone.now()
        prefixo = f'HPVp{agora.strftime("%d%m%y")}-'
        ultimo = (
            Placa.objects.filter(codigo__startswith=prefixo)
            .order_by('-data_criacao', '-id')
            .values_list('codigo', flat=True)
            .first()
        )
        seq = 1
        if ultimo:
            try:
                seq = int(ultimo.split('-')[-1]) + 1
            except (ValueError, IndexError):
                pass
        return f'{prefixo}{seq}'

    def __str__(self):
        label = self.codigo or f'Placa #{self.pk}'
        tipo = self.get_tipo_placa_display()
        return f'{label} [{tipo}] ({self.get_status_placa_display()})'

    @property
    def total_amostras(self):
        return self.pocos.filter(tipo_conteudo=TipoConteudoPoco.AMOSTRA).count()

    def _amostras_ids(self):
        return list(
            self.pocos.filter(
                tipo_conteudo=TipoConteudoPoco.AMOSTRA,
                amostra__isnull=False,
            ).values_list('amostra_id', flat=True)
        )

    # ------------------------------------------------------------------
    # Módulo de Extração
    # ------------------------------------------------------------------

    def confirmar_extracao(self, operador=None):
        """Scan do código da placa após extração: amostras → Extraída; placa → Extração confirmada."""
        from auditlog.context import set_actor
        ctx = set_actor(operador) if operador else _noop_ctx()
        with transaction.atomic(), ctx:
            for amostra in Amostra.objects.filter(pk__in=self._amostras_ids()):
                amostra.status = StatusAmostra.EXTRAIDA
                amostra.save(update_fields=['status', 'atualizado_em'])
            self.status_placa = StatusPlaca.EXTRACAO_CONFIRMADA
            if operador:
                self.extracao_confirmada_por = operador
            self.save(update_fields=['status_placa', 'extracao_confirmada_por', 'atualizado_em'])

    # ------------------------------------------------------------------
    # Módulo de PCR
    # ------------------------------------------------------------------

    def submeter_termociclador(self):
        """Envia a placa PCR ao termociclador: placa → Submetida."""
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
    grupo = models.PositiveSmallIntegerField(
        default=1,
        verbose_name='Grupo de extração',
        help_text='Grupo de reagentes ao qual este poço pertence (1, 2, 3...).',
    )

    class Meta:
        verbose_name = 'Poço'
        verbose_name_plural = 'Poços'
        unique_together = [('placa', 'posicao')]
        ordering = ['posicao']

    def __str__(self):
        amostra_label = self.amostra.codigo_interno if self.amostra else self.get_tipo_conteudo_display()
        return f'Poço {self.posicao} ({amostra_label})'
