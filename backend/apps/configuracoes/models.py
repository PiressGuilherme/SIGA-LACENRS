from django.db import models


class ReacaoProtocolo(models.Model):
    """
    Protocolo de reacao PCR: agrupa reagentes e seus volumes por reacao.
    Ex: "IBMP HPV Padrao" com Master Mix 15 uL + Primer Mix 5 uL.
    """
    nome = models.CharField(max_length=100, unique=True, verbose_name='Nome')
    descricao = models.TextField(blank=True, verbose_name='Descricao')
    ativo = models.BooleanField(default=True, verbose_name='Ativo')
    margem_percentual = models.FloatField(
        default=10.0, verbose_name='Margem extra (%)',
        help_text='Percentual adicional sobre o volume total (ex: 10 = +10%). Compensa perdas de pipetagem.',
    )
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Protocolo de reacao'
        verbose_name_plural = 'Protocolos de reacao'
        ordering = ['nome']

    def __str__(self):
        return self.nome


class ReacaoReagente(models.Model):
    """Reagente de um protocolo de reacao, com volume por reacao em uL."""
    protocolo = models.ForeignKey(
        ReacaoProtocolo, on_delete=models.CASCADE,
        related_name='reagentes', verbose_name='Protocolo',
    )
    nome = models.CharField(max_length=100, verbose_name='Reagente')
    volume_por_reacao = models.DecimalField(
        max_digits=7, decimal_places=2, verbose_name='Volume por reacao (uL)',
    )
    ordem = models.PositiveSmallIntegerField(default=0, verbose_name='Ordem')

    class Meta:
        verbose_name = 'Reagente'
        verbose_name_plural = 'Reagentes'
        ordering = ['ordem', 'id']
        unique_together = [('protocolo', 'nome')]

    def __str__(self):
        return f'{self.nome} ({self.volume_por_reacao} uL)'


class KitInterpretacao(models.Model):
    """
    Kit de interpretacao de resultados PCR.
    Define os limiares de Cq para classificacao de controles e amostras.
    """
    nome = models.CharField(max_length=100, unique=True, verbose_name='Nome')
    descricao = models.TextField(blank=True, verbose_name='Descricao')
    ativo = models.BooleanField(default=True, verbose_name='Ativo')
    cq_controle_max = models.FloatField(
        default=25.0, verbose_name='Cq maximo controles',
        help_text='CP: todos os canais devem ter Cq <= este valor. CN: CI deve ter Cq <= este valor.',
    )
    cq_amostra_ci_max = models.FloatField(
        default=33.0, verbose_name='Cq maximo CI amostra',
        help_text='Amostra CI: positivo se Cq <= este valor.',
    )
    cq_amostra_hpv_max = models.FloatField(
        default=40.0, verbose_name='Cq maximo HPV amostra',
        help_text='Amostra HPV: positivo se Cq <= este valor.',
    )
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')
    atualizado_em = models.DateTimeField(auto_now=True, verbose_name='Atualizado em')

    class Meta:
        verbose_name = 'Kit de interpretacao'
        verbose_name_plural = 'Kits de interpretacao'
        ordering = ['nome']

    def __str__(self):
        return self.nome


class PlacaGrupoReacao(models.Model):
    """Associa um protocolo de reacao a um grupo de pocos em uma placa PCR."""
    placa = models.ForeignKey(
        'placas.Placa', on_delete=models.CASCADE,
        related_name='grupo_reacoes', verbose_name='Placa',
    )
    grupo = models.PositiveSmallIntegerField(verbose_name='Grupo')
    protocolo = models.ForeignKey(
        ReacaoProtocolo, on_delete=models.PROTECT,
        verbose_name='Protocolo de reacao',
    )

    class Meta:
        verbose_name = 'Reacao por grupo da placa'
        verbose_name_plural = 'Reacoes por grupo da placa'
        unique_together = [('placa', 'grupo')]

    def __str__(self):
        return f'Placa {self.placa_id} / Grupo {self.grupo} → {self.protocolo}'
