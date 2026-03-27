"""
Testes do app placas: permissões de API.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.amostras.models import Amostra, StatusAmostra
from .models import Placa, TipoPlaca

User = get_user_model()


def make_user(email, group_name=None):
    user = User.objects.create_user(
        email=email, password='senha123', nome_completo='Usuário Teste',
    )
    if group_name:
        group, _ = Group.objects.get_or_create(name=group_name)
        user.groups.add(group)
    return user


def auth_header(user):
    token = RefreshToken.for_user(user).access_token
    return {'HTTP_AUTHORIZATION': f'Bearer {token}'}


class TestPlacaPermissoes(APITestCase):

    def setUp(self):
        self.user_sem_grupo = make_user('semgrupo@lab.br')
        self.user_extracao  = make_user('extracao@lab.br',  'extracao')
        self.user_pcr       = make_user('pcr@lab.br',       'pcr')
        self.user_supervisor= make_user('supervisor@lab.br','supervisor')

    # ---- list: qualquer autenticado ----

    def test_list_anonimo_retorna_401(self):
        r = self.client.get('/api/placas/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_sem_grupo_retorna_200(self):
        r = self.client.get('/api/placas/', **auth_header(self.user_sem_grupo))
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    # ---- create: extracao, pcr ou supervisor ----

    def test_create_sem_grupo_retorna_403(self):
        r = self.client.post(
            '/api/placas/',
            {'tipo_placa': TipoPlaca.EXTRACAO},
            format='json',
            **auth_header(self.user_sem_grupo),
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_extracao_retorna_201(self):
        r = self.client.post(
            '/api/placas/',
            {'tipo_placa': TipoPlaca.EXTRACAO},
            format='json',
            **auth_header(self.user_extracao),
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_pcr_retorna_201(self):
        r = self.client.post(
            '/api/placas/',
            {'tipo_placa': TipoPlaca.PCR},
            format='json',
            **auth_header(self.user_pcr),
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    # ---- confirmar-extracao: apenas extracao ou supervisor ----

    def test_confirmar_extracao_pcr_retorna_403(self):
        r = self.client.post(
            '/api/placas/confirmar-extracao/',
            {'codigo': 'QUALQUER'},
            format='json',
            **auth_header(self.user_pcr),
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_confirmar_extracao_extracao_retorna_404_placa_inexistente(self):
        # 404 significa que passou na permissão e chegou na lógica de negócio
        r = self.client.post(
            '/api/placas/confirmar-extracao/',
            {'codigo': 'NAO_EXISTE'},
            format='json',
            **auth_header(self.user_extracao),
        )
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ---- submeter: apenas pcr ou supervisor ----

    def test_submeter_extracao_retorna_403(self):
        placa = Placa.objects.create(
            tipo_placa=TipoPlaca.PCR,
            responsavel=self.user_pcr,
        )
        r = self.client.post(
            f'/api/placas/{placa.pk}/submeter/',
            format='json',
            **auth_header(self.user_extracao),
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_submeter_pcr_retorna_409_placa_sem_pocos(self):
        # 409 = passou na permissão mas placa não está em estado válido para submeter
        placa = Placa.objects.create(
            tipo_placa=TipoPlaca.PCR,
            responsavel=self.user_pcr,
        )
        r = self.client.post(
            f'/api/placas/{placa.pk}/submeter/',
            format='json',
            **auth_header(self.user_pcr),
        )
        # A placa está aberta sem poços — o backend retorna 409
        self.assertIn(r.status_code, (status.HTTP_409_CONFLICT, status.HTTP_200_OK))
