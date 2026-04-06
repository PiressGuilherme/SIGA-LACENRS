"""
Configuração persistida do GAL WebService.

Permite que supervisores configurem credenciais e o código do laboratório
diretamente pela interface, sem precisar editar o .env.

Apenas um registro ativo por instalação (singleton via pk=1).
"""
from django.db import models


class GalWsConfig(models.Model):
    usuario          = models.CharField(max_length=100, blank=True, verbose_name='Usuário GAL')
    senha            = models.CharField(max_length=255, blank=True, verbose_name='Senha GAL',
                                        help_text='Armazenada em texto simples — use usuário dedicado de integração.')
    codigo_laboratorio = models.CharField(max_length=50, blank=True, verbose_name='Código do laboratório',
                                          help_text='Parâmetro "laboratorio" usado em buscarExames.')
    url_ws           = models.CharField(
        max_length=255, blank=True,
        default='https://gal.riograndedosul.sus.gov.br/webservice/automacao',
        verbose_name='URL do WebService',
    )
    verificar_ssl    = models.BooleanField(default=False, verbose_name='Verificar SSL',
                                           help_text='Desative se o servidor GAL usar certificado auto-assinado.')
    atualizado_em    = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Configuração GAL WS'
        verbose_name_plural = 'Configuração GAL WS'

    def __str__(self):
        return f'GAL WS — {self.url_ws}'

    @classmethod
    def get(cls) -> 'GalWsConfig':
        """Retorna (ou cria) o registro singleton de configuração."""
        try:
            return cls.objects.get(pk=1)
        except cls.DoesNotExist:
            from django.db import IntegrityError
            try:
                return cls.objects.create(pk=1)
            except IntegrityError:
                return cls.objects.get(pk=1)
