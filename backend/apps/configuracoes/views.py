from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from apps.usuarios.permissions import IsSupervisor
from .models import KitExtracao, KitInterpretacao, ReacaoProtocolo
from .serializers import KitExtracaoSerializer, KitInterpretacaoSerializer, ReacaoProtocoloSerializer


@method_decorator(login_required, name='dispatch')
class ConfiguracoesPageView(TemplateView):
    template_name = 'configuracoes/index.html'

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_staff:
            from django.http import HttpResponseForbidden
            return HttpResponseForbidden('Acesso restrito a supervisores.')
        return super().dispatch(request, *args, **kwargs)


class _SupervisorWriteMixin:
    """Leitura para qualquer autenticado; escrita restrita a Supervisor."""

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsSupervisor()]


class KitExtracaoViewSet(_SupervisorWriteMixin, ModelViewSet):
    serializer_class = KitExtracaoSerializer

    def get_queryset(self):
        qs = KitExtracao.objects.all()
        if self.request.query_params.get('ativo') == 'true':
            qs = qs.filter(ativo=True)
        return qs


class ReacaoProtocoloViewSet(_SupervisorWriteMixin, ModelViewSet):
    serializer_class = ReacaoProtocoloSerializer

    def get_queryset(self):
        qs = ReacaoProtocolo.objects.prefetch_related('reagentes').all()
        if self.request.query_params.get('ativo') == 'true':
            qs = qs.filter(ativo=True)
        return qs


class KitInterpretacaoViewSet(_SupervisorWriteMixin, ModelViewSet):
    serializer_class = KitInterpretacaoSerializer

    def get_queryset(self):
        qs = KitInterpretacao.objects.prefetch_related(
            'alvos__limiares',
            'regras_interpretacao',
        ).all()
        if self.request.query_params.get('ativo') == 'true':
            qs = qs.filter(ativo=True)
        return qs
