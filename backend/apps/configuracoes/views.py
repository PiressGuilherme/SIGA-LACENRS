from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView
from rest_framework.permissions import IsAdminUser
from rest_framework.viewsets import ModelViewSet

from .models import KitInterpretacao, ReacaoProtocolo
from .serializers import KitInterpretacaoSerializer, ReacaoProtocoloSerializer


@method_decorator(login_required, name='dispatch')
class ConfiguracoesPageView(TemplateView):
    template_name = 'configuracoes/index.html'

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_staff:
            from django.http import HttpResponseForbidden
            return HttpResponseForbidden('Acesso restrito a supervisores.')
        return super().dispatch(request, *args, **kwargs)


class ReacaoProtocoloViewSet(ModelViewSet):
    serializer_class = ReacaoProtocoloSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = ReacaoProtocolo.objects.prefetch_related('reagentes').all()
        if self.request.query_params.get('ativo') == 'true':
            qs = qs.filter(ativo=True)
        return qs


class KitInterpretacaoViewSet(ModelViewSet):
    serializer_class = KitInterpretacaoSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = KitInterpretacao.objects.prefetch_related(
            'alvos__limiares',
            'regras_interpretacao',
        ).all()
        if self.request.query_params.get('ativo') == 'true':
            qs = qs.filter(ativo=True)
        return qs
