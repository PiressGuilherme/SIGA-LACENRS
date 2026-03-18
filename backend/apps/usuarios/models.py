from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UsuarioManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('O e-mail é obrigatório.')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser deve ter is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser deve ter is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class Usuario(AbstractBaseUser, PermissionsMixin):
    """
    Usuário customizado com login por e-mail.
    Perfis de acesso são gerenciados via Groups do Django:
      - extracao  → monta placas, importa CSV GAL
      - pcr       → importa resultados, revisa e confirma
      - supervisor → todas as operações + edição manual
    """

    email = models.EmailField(unique=True, verbose_name='E-mail')
    nome_completo = models.CharField(max_length=150, verbose_name='Nome completo')
    is_active = models.BooleanField(default=True, verbose_name='Ativo')
    is_staff = models.BooleanField(default=False, verbose_name='Acesso ao admin')
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Criado em')

    objects = UsuarioManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['nome_completo']

    class Meta:
        verbose_name = 'Usuário'
        verbose_name_plural = 'Usuários'
        ordering = ['nome_completo']

    def __str__(self):
        return f'{self.nome_completo} ({self.email})'

    @property
    def perfil(self):
        """Retorna o nome do grupo principal do usuário."""
        group = self.groups.first()
        return group.name if group else 'sem perfil'
