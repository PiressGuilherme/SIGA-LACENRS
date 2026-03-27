"""
Testes do app resultados: permissões de API.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

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


class TestResultadoPermissoes(APITestCase):

    def setUp(self):
        self.user_sem_grupo = make_user('semgrupo@lab.br')
        self.user_extracao  = make_user('extracao@lab.br',  'extracao')
        self.user_pcr       = make_user('pcr@lab.br',       'pcr')
        self.user_supervisor= make_user('supervisor@lab.br','supervisor')

    # ---- list: qualquer autenticado ----

    def test_list_anonimo_retorna_401(self):
        r = self.client.get('/api/resultados/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_sem_grupo_retorna_200(self):
        r = self.client.get('/api/resultados/', **auth_header(self.user_sem_grupo))
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    # ---- importar: apenas pcr ou supervisor ----

    def test_importar_sem_grupo_retorna_403(self):
        r = self.client.post(
            '/api/resultados/importar/',
            **auth_header(self.user_sem_grupo),
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_importar_extracao_retorna_403(self):
        r = self.client.post(
            '/api/resultados/importar/',
            **auth_header(self.user_extracao),
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_importar_pcr_retorna_400_sem_arquivo(self):
        # 400 significa que passou na permissão e chegou na validação do body
        r = self.client.post(
            '/api/resultados/importar/',
            **auth_header(self.user_pcr),
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_importar_supervisor_retorna_400_sem_arquivo(self):
        r = self.client.post(
            '/api/resultados/importar/',
            **auth_header(self.user_supervisor),
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ---- confirmar resultado: apenas pcr ou supervisor ----

    def test_confirmar_sem_grupo_retorna_403(self):
        r = self.client.post(
            '/api/resultados/9999/confirmar/',
            **auth_header(self.user_sem_grupo),
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_confirmar_extracao_retorna_403(self):
        r = self.client.post(
            '/api/resultados/9999/confirmar/',
            **auth_header(self.user_extracao),
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_confirmar_pcr_retorna_404_inexistente(self):
        # 404 = passou na permissão, objeto não existe
        r = self.client.post(
            '/api/resultados/9999/confirmar/',
            **auth_header(self.user_pcr),
        )
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ---- override de canal (ResultadoPocoViewSet): apenas pcr ou supervisor ----

    def test_patch_poco_sem_grupo_retorna_403(self):
        r = self.client.patch(
            '/api/resultados/pocos/9999/',
            {'interpretacao_manual': 'positivo'},
            format='json',
            **auth_header(self.user_sem_grupo),
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_patch_poco_extracao_retorna_403(self):
        r = self.client.patch(
            '/api/resultados/pocos/9999/',
            {'interpretacao_manual': 'positivo'},
            format='json',
            **auth_header(self.user_extracao),
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_patch_poco_pcr_retorna_404_inexistente(self):
        r = self.client.patch(
            '/api/resultados/pocos/9999/',
            {'interpretacao_manual': 'positivo'},
            format='json',
            **auth_header(self.user_pcr),
        )
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)
