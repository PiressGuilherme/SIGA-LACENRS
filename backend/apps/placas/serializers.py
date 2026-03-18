from rest_framework import serializers
from .models import Placa, Poco

# ----------------------------------------------------------------------------
# Implementados na Fase 3
# ----------------------------------------------------------------------------


class PocoSerializer(serializers.ModelSerializer):
    amostra_codigo = serializers.CharField(
        source='amostra.codigo_interno', read_only=True, allow_null=True
    )

    class Meta:
        model = Poco
        fields = ('id', 'posicao', 'tipo_conteudo', 'amostra', 'amostra_codigo')


class PlacaSerializer(serializers.ModelSerializer):
    pocos = PocoSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_placa_display', read_only=True)
    total_amostras = serializers.ReadOnlyField()

    class Meta:
        model = Placa
        fields = (
            'id', 'protocolo', 'responsavel', 'status_placa', 'status_display',
            'observacoes', 'total_amostras', 'data_criacao', 'pocos',
        )
        read_only_fields = ('id', 'status_display', 'total_amostras', 'data_criacao')
