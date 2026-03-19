from rest_framework import serializers

from .models import Placa, Poco, TipoConteudoPoco


class PocoSerializer(serializers.ModelSerializer):
    amostra_codigo = serializers.CharField(
        source='amostra.codigo_interno', read_only=True, allow_null=True,
    )
    amostra_nome = serializers.CharField(
        source='amostra.nome_paciente', read_only=True, allow_null=True,
    )

    class Meta:
        model = Poco
        fields = (
            'id', 'posicao', 'tipo_conteudo',
            'amostra', 'amostra_codigo', 'amostra_nome',
        )


class PlacaSerializer(serializers.ModelSerializer):
    pocos = PocoSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_placa_display', read_only=True)
    total_amostras = serializers.ReadOnlyField()
    responsavel_nome = serializers.CharField(
        source='responsavel.nome_completo', read_only=True, default=None,
    )

    class Meta:
        model = Placa
        fields = (
            'id', 'codigo', 'protocolo', 'responsavel', 'responsavel_nome',
            'status_placa', 'status_display',
            'observacoes', 'total_amostras', 'data_criacao', 'pocos',
        )
        read_only_fields = (
            'id', 'codigo', 'status_display', 'total_amostras', 'data_criacao',
        )


class PocoInputSerializer(serializers.Serializer):
    """Entrada de um poço individual no bulk save."""
    posicao = serializers.CharField(max_length=3)
    tipo_conteudo = serializers.ChoiceField(choices=TipoConteudoPoco.choices)
    amostra_codigo = serializers.CharField(
        required=False, allow_blank=True, allow_null=True,
    )
