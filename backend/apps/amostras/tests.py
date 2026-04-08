"""
Testes do app amostras: state machine e permissões de API.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Amostra, StatusAmostra, TRANSICOES_VALIDAS, validar_transicao

User = get_user_model()


# ── Helpers ────────────────────────────────────────────────────────────────────

def make_user(email, group_name=None, numero_cracha=None, is_superuser=False):
    user = User.objects.create_user(
        email=email, password='senha123', nome_completo='Usuário Teste',
        **(({'numero_cracha': numero_cracha}) if numero_cracha else {}),
    )
    if is_superuser:
        user.is_superuser = True
        user.save(update_fields=['is_superuser'])
    if group_name:
        group, _ = Group.objects.get_or_create(name=group_name)
        user.groups.add(group)
    return user


def auth_header(user):
    token = RefreshToken.for_user(user).access_token
    return {'HTTP_AUTHORIZATION': f'Bearer {token}'}


def make_amostra(**kwargs):
    defaults = dict(
        cod_exame_gal='EX001',
        numero_gal='REQ001',
        nome_paciente='Paciente Teste',
        status=StatusAmostra.AGUARDANDO_TRIAGEM,
    )
    defaults.update(kwargs)
    return Amostra.objects.create(**defaults)


# ── State machine ──────────────────────────────────────────────────────────────

class TestTransicoesValidas(TestCase):
    """Verifica que o dicionário TRANSICOES_VALIDAS cobre todos os statuses."""

    def test_todos_os_statuses_tem_entrada(self):
        for s in StatusAmostra.values:
            self.assertIn(s, TRANSICOES_VALIDAS, f'Status "{s}" não tem entrada em TRANSICOES_VALIDAS')

    def test_todas_as_transicoes_apontam_para_statuses_validos(self):
        validos = set(StatusAmostra.values)
        for origem, destinos in TRANSICOES_VALIDAS.items():
            for d in destinos:
                self.assertIn(d, validos, f'Destino inválido: {origem} → {d}')


class TestValidarTransicao(TestCase):

    def test_transicoes_validas_nao_levantam_excecao(self):
        casos = [
            (StatusAmostra.AGUARDANDO_TRIAGEM,   StatusAmostra.ALIQUOTADA),
            (StatusAmostra.ALIQUOTADA,           StatusAmostra.EXTRACAO),
            (StatusAmostra.EXTRACAO,             StatusAmostra.EXTRAIDA),
            (StatusAmostra.EXTRACAO,             StatusAmostra.ALIQUOTADA),
            (StatusAmostra.EXTRAIDA,             StatusAmostra.PCR),
            (StatusAmostra.PCR,                  StatusAmostra.RESULTADO),
            (StatusAmostra.PCR,                  StatusAmostra.EXTRAIDA),
            (StatusAmostra.RESULTADO,            StatusAmostra.RESULTADO_LIBERADO),
            (StatusAmostra.RESULTADO,            StatusAmostra.REPETICAO_SOLICITADA),
            (StatusAmostra.REPETICAO_SOLICITADA, StatusAmostra.PCR),
        ]
        for atual, novo in casos:
            with self.subTest(atual=atual, novo=novo):
                # Não deve levantar
                validar_transicao(atual, novo)

    def test_transicoes_invalidas_levantam_validation_error(self):
        invalidas = [
            (StatusAmostra.AGUARDANDO_TRIAGEM, StatusAmostra.RESULTADO),
            (StatusAmostra.ALIQUOTADA,         StatusAmostra.RESULTADO_LIBERADO),
            (StatusAmostra.EXTRAIDA,           StatusAmostra.ALIQUOTADA),
            (StatusAmostra.EXTRAIDA,           StatusAmostra.RESULTADO),    # deve passar por PCR
            (StatusAmostra.RESULTADO_LIBERADO, StatusAmostra.ALIQUOTADA),
            (StatusAmostra.CANCELADA,          StatusAmostra.ALIQUOTADA),
        ]
        for atual, novo in invalidas:
            with self.subTest(atual=atual, novo=novo):
                with self.assertRaises(ValidationError):
                    validar_transicao(atual, novo)

    def test_cancelada_e_terminal(self):
        for s in StatusAmostra.values:
            if s == StatusAmostra.CANCELADA:
                continue
            with self.subTest(origem=StatusAmostra.CANCELADA, destino=s):
                with self.assertRaises(ValidationError):
                    validar_transicao(StatusAmostra.CANCELADA, s)


# ── Permissões — AmostraViewSet ────────────────────────────────────────────────

class TestAmostraPermissoes(APITestCase):

    def setUp(self):
        self.user_anon      = None
        self.user_sem_grupo = make_user('semgrupo@lab.br')
        self.user_extracao  = make_user('extracao@lab.br',  'tecnico',  numero_cracha='CRACHA_EXT')
        self.user_pcr       = make_user('pcr@lab.br',       'especialista')
        self.user_supervisor= make_user('supervisor@lab.br','supervisor', is_superuser=True)
        self.amostra = make_amostra()

    # ---- list/retrieve: todos os autenticados ----

    def test_list_anonimo_retorna_401(self):
        r = self.client.get('/api/amostras/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_autenticado_retorna_200(self):
        for user in (self.user_sem_grupo, self.user_extracao, self.user_pcr, self.user_supervisor):
            with self.subTest(user=user.email):
                r = self.client.get('/api/amostras/', **auth_header(user))
                self.assertEqual(r.status_code, status.HTTP_200_OK)

    # ---- receber: extracao ou supervisor ----

    def test_receber_sem_grupo_retorna_403(self):
        r = self.client.post(
            '/api/amostras/receber/',
            {'codigo': self.amostra.cod_exame_gal},
            format='json',
            **auth_header(self.user_sem_grupo),
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_receber_especialista_nao_retorna_403(self):
        r = self.client.post(
            '/api/amostras/receber/',
            {'codigo': self.amostra.cod_exame_gal},
            format='json',
            **auth_header(self.user_pcr),
        )
        self.assertNotEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_receber_extracao_retorna_200(self):
        r = self.client.post(
            '/api/amostras/receber/',
            {'codigo': self.amostra.cod_exame_gal, 'numero_cracha': 'CRACHA_EXT'},
            format='json',
            **auth_header(self.user_extracao),
        )
        self.assertIn(r.status_code, (status.HTTP_200_OK,))

    def test_receber_supervisor_retorna_200(self):
        r = self.client.post(
            '/api/amostras/receber/',
            {'codigo': self.amostra.cod_exame_gal},
            format='json',
            **auth_header(self.user_supervisor),
        )
        self.assertIn(r.status_code, (status.HTTP_200_OK,))

    # ---- create/destroy: apenas supervisor ----

    def test_create_extracao_retorna_403(self):
        r = self.client.post(
            '/api/amostras/',
            {
                'cod_exame_gal': 'EX_NOVO',
                'numero_gal': 'REQ999',
                'nome_paciente': 'Novo',
                'status': StatusAmostra.AGUARDANDO_TRIAGEM,
            },
            format='json',
            **auth_header(self.user_extracao),
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_supervisor_retorna_201(self):
        r = self.client.post(
            '/api/amostras/',
            {
                'cod_exame_gal': 'EX_NOVO',
                'numero_gal': 'REQ999',
                'nome_paciente': 'Novo',
                'status': StatusAmostra.AGUARDANDO_TRIAGEM,
            },
            format='json',
            **auth_header(self.user_supervisor),
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_destroy_extracao_retorna_403(self):
        r = self.client.delete(
            f'/api/amostras/{self.amostra.pk}/',
            **auth_header(self.user_extracao),
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_destroy_supervisor_retorna_204(self):
        r = self.client.delete(
            f'/api/amostras/{self.amostra.pk}/',
            **auth_header(self.user_supervisor),
        )
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
