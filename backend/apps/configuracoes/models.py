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


# ── Modelos para interpretação genérica dirigida por configuração ─────────────

class TipoAlvo(models.TextChoices):
    PATOGENO = 'PATOGENO', 'Patógeno'
    CONTROLE_INTERNO = 'CONTROLE_INTERNO', 'Controle Interno'
    CONTROLE_EXTERNO = 'CONTROLE_EXTERNO', 'Controle Externo'


class ContextoLimiar(models.TextChoices):
    CP = 'CP', 'Controle Positivo'
    CN = 'CN', 'Controle Negativo'
    AMOSTRA_POSITIVO = 'AMOSTRA_POSITIVO', 'Amostra Positivo'


class OperadorLimiar(models.TextChoices):
    LTE = 'LTE', 'Ct ≤ valor'
    GTE = 'GTE', 'Ct ≥ valor'
    SEM_AMP = 'SEM_AMP', 'Sem amplificação'


class TipoResultado(models.TextChoices):
    DETECTADO = 'DETECTADO', 'Detectado'
    NAO_DETECTADO = 'NAO_DETECTADO', 'Não detectado'
    INVALIDO_ENSAIO = 'INVALIDO_ENSAIO', 'Ensaio inválido'
    INVALIDO_AMOSTRA = 'INVALIDO_AMOSTRA', 'Amostra inválida'
    REVISAO_MANUAL = 'REVISAO_MANUAL', 'Revisão manual necessária'


class KitAlvo(models.Model):
    """
    Alvo (canal/fluoróforo) de um kit PCR.
    Ex: CI (controle interno), HPV16 (patógeno), HPV18, HPV_AR.
    """
    kit = models.ForeignKey(
        KitInterpretacao, on_delete=models.CASCADE,
        related_name='alvos', verbose_name='Kit',
    )
    nome = models.CharField(max_length=100, verbose_name='Nome')
    tipo_alvo = models.CharField(
        max_length=20, choices=TipoAlvo.choices,
        default=TipoAlvo.PATOGENO, verbose_name='Tipo',
    )
    canal = models.CharField(max_length=50, blank=True, verbose_name='Canal/Fluoróforo')
    ordem = models.PositiveSmallIntegerField(default=0, verbose_name='Ordem')

    class Meta:
        ordering = ['ordem', 'id']
        unique_together = [('kit', 'nome')]
        verbose_name = 'Alvo do kit'
        verbose_name_plural = 'Alvos do kit'

    def __str__(self):
        return f'{self.kit.nome} / {self.nome}'


class RegrasLimiar(models.Model):
    """
    Threshold de Cq para um alvo em um dado contexto de interpretação.
    Ex: CI/CP → LTE 25.0 significa que o CI no poço CP deve ter Cq ≤ 25.
    """
    alvo = models.ForeignKey(
        KitAlvo, on_delete=models.CASCADE,
        related_name='limiares', verbose_name='Alvo',
    )
    contexto = models.CharField(
        max_length=20, choices=ContextoLimiar.choices,
        verbose_name='Contexto',
    )
    operador = models.CharField(
        max_length=10, choices=OperadorLimiar.choices,
        default=OperadorLimiar.LTE, verbose_name='Operador',
    )
    ct_limiar = models.FloatField(
        null=True, blank=True, verbose_name='Ct limiar',
        help_text='Valor do limiar de Cq. Vazio quando operador = SEM_AMP.',
    )

    class Meta:
        unique_together = [('alvo', 'contexto')]
        verbose_name = 'Limiar de Cq'
        verbose_name_plural = 'Limiares de Cq'

    def __str__(self):
        if self.operador == OperadorLimiar.SEM_AMP:
            return f'{self.alvo.nome}/{self.contexto}: sem amplificação'
        return f'{self.alvo.nome}/{self.contexto}: {self.operador} {self.ct_limiar}'


class RegraInterpretacao(models.Model):
    """
    Regra de interpretação: mapeia combinação de resultados por alvo a um laudo.
    As regras são avaliadas em ordem crescente de prioridade; a primeira que
    satisfizer todas as condições define o resultado da amostra.
    """
    kit = models.ForeignKey(
        KitInterpretacao, on_delete=models.CASCADE,
        related_name='regras_interpretacao', verbose_name='Kit',
    )
    prioridade = models.PositiveSmallIntegerField(default=10, verbose_name='Prioridade')
    resultado_label = models.CharField(max_length=200, verbose_name='Laudo')
    resultado_codigo = models.CharField(
        max_length=50, blank=True, verbose_name='Código',
        help_text='Código interno do resultado (ex: hpv16, hpv_nao_detectado, invalido).',
    )
    tipo_resultado = models.CharField(
        max_length=20, choices=TipoResultado.choices,
        verbose_name='Tipo de resultado',
    )
    condicoes = models.JSONField(
        verbose_name='Condições',
        help_text=(
            'Dicionário: chave = nome do alvo ou "CP"/"CN"; '
            'valor = "POSITIVO" | "NEGATIVO" | "QUALQUER" | "VALIDO" | "INVALIDO".'
        ),
    )

    class Meta:
        ordering = ['prioridade']
        verbose_name = 'Regra de interpretação'
        verbose_name_plural = 'Regras de interpretação'

    def __str__(self):
        return f'[{self.prioridade}] {self.resultado_label}'
