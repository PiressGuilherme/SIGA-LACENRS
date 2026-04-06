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
            'id', 'posicao', 'tipo_conteudo', 'grupo',
            'amostra', 'amostra_codigo', 'amostra_nome',
        )


class PlacaSerializer(serializers.ModelSerializer):
    pocos = PocoSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_placa_display', read_only=True)
    tipo_placa_display = serializers.CharField(source='get_tipo_placa_display', read_only=True)
    total_amostras = serializers.ReadOnlyField()
    responsavel_nome = serializers.CharField(
        source='responsavel.nome_completo', read_only=True, default=None,
    )
    placa_origem_codigo = serializers.CharField(
        source='placa_origem.codigo', read_only=True, allow_null=True,
    )
    grupos_count = serializers.SerializerMethodField()

    def get_grupos_count(self, obj):
        grupos = obj.pocos.values_list('grupo', flat=True).distinct()
        return len(set(grupos))

    class Meta:
        model = Placa
        fields = (
            'id', 'codigo', 'tipo_placa', 'tipo_placa_display',
            'placa_origem', 'placa_origem_codigo',
            'protocolo', 'responsavel', 'responsavel_nome',
            'status_placa', 'status_display',
            'observacoes', 'total_amostras', 'grupos_count', 'data_criacao', 'pocos',
        )
        read_only_fields = (
            'id', 'codigo', 'status_display', 'tipo_placa_display',
            'total_amostras', 'data_criacao',
        )


class PocoInputSerializer(serializers.Serializer):
    """Entrada de um poço individual no bulk save."""
    posicao = serializers.CharField(max_length=3)
    tipo_conteudo = serializers.ChoiceField(choices=TipoConteudoPoco.choices)
    amostra_codigo = serializers.CharField(
        required=False, allow_blank=True, allow_null=True,
    )
    grupo = serializers.IntegerField(default=1, min_value=1)
