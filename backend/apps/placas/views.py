from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView
from rest_framework import status, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.amostras.models import Amostra, StatusAmostra
from apps.amostras.serializers import AmostraSerializer
from .models import Placa, Poco, StatusPlaca, TipoConteudoPoco
from .serializers import PlacaSerializer, PocoInputSerializer


@method_decorator(login_required, name='dispatch')
class MontarPlacaView(TemplateView):
    """Página de montagem de placa de extração (React via django-vite)."""
    template_name = 'placas/montar.html'


class PlacaViewSet(viewsets.ModelViewSet):
    queryset = Placa.objects.prefetch_related('pocos__amostra').all()
    serializer_class = PlacaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(responsavel=self.request.user)

    # ------------------------------------------------------------------
    # Buscar amostra elegível para a placa
    # ------------------------------------------------------------------

    @action(detail=False, methods=['get'], url_path='buscar-amostra')
    def buscar_amostra(self, request):
        """
        GET /api/placas/buscar-amostra/?codigo=<valor>

        Busca amostra por codigo_interno (match exato).
        Só retorna amostras com status Aliquotada.
        """
        codigo = request.query_params.get('codigo', '').strip()
        if not codigo:
            return Response(
                {'erro': 'Parâmetro "codigo" obrigatório.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        amostra = Amostra.objects.filter(
            codigo_interno=codigo,
            status=StatusAmostra.ALIQUOTADA,
        ).first()

        if not amostra:
            # Verificar se existe mas com status errado (feedback útil)
            existe = Amostra.objects.filter(codigo_interno=codigo).first()
            if existe:
                return Response(
                    {'erro': f'Amostra {codigo} está com status "{existe.get_status_display()}" — precisa estar Aliquotada.'},
                    status=status.HTTP_409_CONFLICT,
                )
            return Response(
                {'erro': f'Amostra "{codigo}" não encontrada.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(AmostraSerializer(amostra).data)

    # ------------------------------------------------------------------
    # Salvar poços (bulk)
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='salvar-pocos')
    def salvar_pocos(self, request, pk=None):
        """
        POST /api/placas/{id}/salvar-pocos/
        Body: { "pocos": [{ "posicao": "A01", "tipo_conteudo": "amostra", "amostra_codigo": "42/26" }, ...] }

        Substitui todos os poços da placa. Atualiza status das amostras para Extração.
        """
        placa = self.get_object()

        if placa.status_placa != StatusPlaca.ABERTA:
            return Response(
                {'erro': 'Placa não está aberta para edição.'},
                status=status.HTTP_409_CONFLICT,
            )

        pocos_data = request.data.get('pocos', [])
        serializer = PocoInputSerializer(data=pocos_data, many=True)
        serializer.is_valid(raise_exception=True)

        # Resolver amostra_codigo → Amostra para cada poço de tipo 'amostra'
        pocos_to_create = []
        amostras_a_atualizar = []
        erros = []

        for item in serializer.validated_data:
            posicao = item['posicao']
            tipo = item['tipo_conteudo']
            amostra_codigo = item.get('amostra_codigo', '').strip() if item.get('amostra_codigo') else ''

            amostra = None
            if tipo == TipoConteudoPoco.AMOSTRA and amostra_codigo:
                amostra = Amostra.objects.filter(codigo_interno=amostra_codigo).first()
                if not amostra:
                    erros.append(f'Poço {posicao}: amostra "{amostra_codigo}" não encontrada.')
                    continue
                amostras_a_atualizar.append(amostra.pk)

            pocos_to_create.append(Poco(
                placa=placa,
                posicao=posicao,
                tipo_conteudo=tipo,
                amostra=amostra,
            ))

        if erros:
            return Response({'erros': erros}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            placa.pocos.all().delete()
            Poco.objects.bulk_create(pocos_to_create)

            if amostras_a_atualizar:
                Amostra.objects.filter(pk__in=amostras_a_atualizar).update(
                    status=StatusAmostra.EXTRACAO,
                )

        placa.refresh_from_db()
        return Response(PlacaSerializer(placa).data)

    # ------------------------------------------------------------------
    # Confirmar extração (scan do código da placa)
    # ------------------------------------------------------------------

    @action(detail=False, methods=['post'], url_path='confirmar-extracao')
    def confirmar_extracao(self, request):
        """
        POST /api/placas/confirmar-extracao/
        Body: { "codigo": "PL2603-0001" }

        Scan do código da placa → todas as amostras → Extraída.
        """
        codigo = (request.data.get('codigo') or '').strip()
        if not codigo:
            return Response(
                {'erro': 'Código da placa não informado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        placa = Placa.objects.prefetch_related('pocos__amostra').filter(codigo=codigo).first()
        if not placa:
            return Response(
                {'erro': f'Placa "{codigo}" não encontrada.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        placa.confirmar_extracao()

        return Response({
            'sucesso': True,
            'placa': PlacaSerializer(placa).data,
        })
