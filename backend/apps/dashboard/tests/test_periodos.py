"""Testes do resolvedor de período."""
from datetime import timedelta

from django.test import RequestFactory, TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.dashboard.periodos import resolver_intervalo


class ResolverIntervaloTest(TestCase):

    def _params(self, **kwargs):
        return kwargs

    def test_default_30d(self):
        intervalo = resolver_intervalo(self._params())
        self.assertLessEqual(
            abs((intervalo.fim - timezone.now()).total_seconds()), 5,
        )
        self.assertEqual(intervalo.dias, 30)

    def test_atalho_7d(self):
        intervalo = resolver_intervalo(self._params(periodo='7d'))
        self.assertEqual(intervalo.dias, 7)

    def test_atalho_invalido(self):
        with self.assertRaises(ValidationError):
            resolver_intervalo(self._params(periodo='42d'))

    def test_custom_datas(self):
        intervalo = resolver_intervalo(self._params(
            data_inicio='2026-01-01', data_fim='2026-01-31',
        ))
        self.assertEqual(intervalo.dias, 31)

    def test_custom_apenas_inicio(self):
        with self.assertRaises(ValidationError):
            resolver_intervalo(self._params(data_inicio='2026-01-01'))

    def test_custom_inicio_posterior_a_fim(self):
        with self.assertRaises(ValidationError):
            resolver_intervalo(self._params(
                data_inicio='2026-02-01', data_fim='2026-01-01',
            ))

    def test_bucket_semanal_para_periodo_longo(self):
        intervalo = resolver_intervalo(self._params(periodo='90d'))
        self.assertEqual(intervalo.bucket, 'week')

    def test_bucket_diario_para_periodo_curto(self):
        intervalo = resolver_intervalo(self._params(periodo='7d'))
        self.assertEqual(intervalo.bucket, 'day')

    def test_periodo_anterior(self):
        intervalo = resolver_intervalo(self._params(periodo='7d'))
        anterior = intervalo.periodo_anterior()
        self.assertEqual(anterior.fim, intervalo.inicio)
        # mesma duração
        self.assertAlmostEqual(
            (anterior.fim - anterior.inicio).total_seconds(),
            (intervalo.fim - intervalo.inicio).total_seconds(),
            delta=1,
        )
