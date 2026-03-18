from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.placas.models import Poco


class CanalPCR(models.TextChoices):
    CI = 'CI', 'Controle Interno (CI)'
    HPV16 = 'HPV16', 'HPV 16'
    HPV18 = 'HPV18', 'HPV 18'
    HPV_AR = 'HPV_AR', 'HPV Alto Risco (AR)'


class InterpretacaoChoices(models.TextChoices):
    POSITIVO = 'positivo', 'Positivo'
    NEGATIVO = 'negativo', 'Negativo'
    INVALIDO = 'invalido', 'Inválido'
    PENDENTE = 'pendente', 'Pendente'


class ResultadoFinalChoices(models.TextChoices):
    HPV_DETECTADO = 'hpv_detectado', 'HPV Detectado'
    HPV_NAO_DETECTADO = 'hpv_nao_detectado', 'HPV Não Detectado'
    INVALIDO = 'invalido', 'Inválido'
    PENDENTE = 'pendente', 'Pendente'


class ResultadoPoco(models.Model):
    """
    Resultado bruto de um canal de PCR para um poço específico.

    Um poço gera até 4 registros (um por canal: CI, HPV16, HPV18, HPV_AR).
    A interpretação automática é calculada pelo parser na Fase 4 com base
    nos critérios IBMP Biomol (cutoffs de Cq — a definir).
    """

    poco = models.ForeignKey(
        Poco, on_delete=models.CASCADE,
        related_name='resultados', verbose_name='Poço',
    )
    canal = models.CharField(max_length=10, choices=CanalPCR.choices, verbose_name='Canal')
    cq = models.FloatField(
        null=True, blank=True, verbose_name='Cq',
        help_text='Valor de Cq do PCR. Vazio = não amplificou (NaN no CSV).',
    )
    interpretacao = models.CharField(
        max_length=20, choices=InterpretacaoChoices.choices,
        default=InterpretacaoChoices.PENDENTE,
        verbose_name='Interpretação automática',
    )
    interpretacao_manual = models.CharField(
        max_length=20, choices=InterpretacaoChoices.choices,
        null=True, blank=True, verbose_name='Interpretação manual',
    )
    justificativa_manual = models.TextField(
        blank=True, verbose_name='Justificativa da edição manual',
        help_text='Obrigatório quando interpretacao_manual é preenchido.',
    )

    class Meta:
        verbose_name = 'Resultado por poço'
        verbose_name_plural = 'Resultados por poço'
        unique_together = [('poco', 'canal')]
        ordering = ['poco__posicao', 'canal']

    def __str__(self):
        return f'Poço {self.poco.posicao} / {self.canal}: Cq={self.cq}'

    def clean(self):
        if self.interpretacao_manual and not self.justificativa_manual:
            raise ValidationError(
                {'justificativa_manual': 'Justificativa é obrigatória ao editar a interpretação manualmente.'}
            )

    @property
    def interpretacao_efetiva(self):
        """Interpretação manual prevalece sobre a automática."""
        return self.interpretacao_manual or self.interpretacao


class ResultadoAmostra(models.Model):
    """
    Resultado consolidado de uma amostra para um run específico (poço em placa).

    Imutabilidade: após confirmação (imutavel=True), nenhum campo pode ser alterado.
    Para retestes, um novo ResultadoAmostra é criado via novo Poco em nova placa.
    O resultado ativo é sempre o último imutavel=True ordenado por confirmado_em.
    """

    poco = models.OneToOneField(
        Poco, on_delete=models.CASCADE,
        related_name='resultado_amostra', verbose_name='Poço',
    )

    # Resultados por canal
    ci_resultado = models.CharField(
        max_length=20, choices=InterpretacaoChoices.choices,
        default=InterpretacaoChoices.PENDENTE, verbose_name='CI',
    )
    hpv16_resultado = models.CharField(
        max_length=20, choices=InterpretacaoChoices.choices,
        default=InterpretacaoChoices.PENDENTE, verbose_name='HPV 16',
    )
    hpv18_resultado = models.CharField(
        max_length=20, choices=InterpretacaoChoices.choices,
        default=InterpretacaoChoices.PENDENTE, verbose_name='HPV 18',
    )
    hpvar_resultado = models.CharField(
        max_length=20, choices=InterpretacaoChoices.choices,
        default=InterpretacaoChoices.PENDENTE, verbose_name='HPV AR',
    )

    # Resultado final consolidado
    resultado_final = models.CharField(
        max_length=30, choices=ResultadoFinalChoices.choices,
        default=ResultadoFinalChoices.PENDENTE, verbose_name='Resultado final',
        db_index=True,
    )

    # Confirmação imutável
    confirmado_em = models.DateTimeField(null=True, blank=True, verbose_name='Confirmado em')
    confirmado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='resultados_confirmados', verbose_name='Confirmado por',
    )
    imutavel = models.BooleanField(
        default=False, verbose_name='Imutável',
        help_text='True após confirmação definitiva. Resultado não pode ser alterado.',
    )

    class Meta:
        verbose_name = 'Resultado da amostra'
        verbose_name_plural = 'Resultados das amostras'

    def __str__(self):
        amostra = self.poco.amostra
        label = amostra.codigo_interno if amostra else f'Poço {self.poco.posicao}'
        return f'Resultado {label}: {self.get_resultado_final_display()}'

    def save(self, *args, **kwargs):
        if self.pk:
            original = ResultadoAmostra.objects.filter(pk=self.pk).values('imutavel').first()
            if original and original['imutavel']:
                raise ValidationError('Resultado imutável não pode ser alterado após confirmação.')
        super().save(*args, **kwargs)
