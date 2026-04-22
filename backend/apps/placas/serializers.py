from rest_framework import serializers

from .models import Placa, Poco, TipoConteudoPoco, TipoPlaca


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
    placas_origem = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Placa.objects.all(), required=False,
    )
    placas_origem_codigos = serializers.SerializerMethodField()
    placa_origem_codigo = serializers.SerializerMethodField()
    kit_extracao_nome = serializers.CharField(
        source='kit_extracao.nome', read_only=True, default=None,
    )
    grupos_count = serializers.SerializerMethodField()

    def get_grupos_count(self, obj):
        grupos = obj.pocos.values_list('grupo', flat=True).distinct()
        return len(set(grupos))

    def get_placas_origem_codigos(self, obj):
        return list(obj.placas_origem.values_list('codigo', flat=True))

    def get_placa_origem_codigo(self, obj):
        primeira = obj.placas_origem.order_by('pk').first()
        return primeira.codigo if primeira else None

    class Meta:
        model = Placa
        fields = (
            'id', 'codigo', 'tipo_placa', 'tipo_placa_display',
            'placas_origem', 'placas_origem_codigos', 'placa_origem_codigo',
            'protocolo', 'responsavel', 'responsavel_nome',
            'kit_extracao', 'kit_extracao_nome',
            'status_placa', 'status_display',
            'observacoes', 'total_amostras', 'grupos_count', 'data_criacao', 'pocos',
        )
        read_only_fields = (
            'id', 'status_display', 'tipo_placa_display',
            'total_amostras', 'data_criacao',
        )

    def validate(self, attrs):
        tipo = attrs.get('tipo_placa', getattr(self.instance, 'tipo_placa', TipoPlaca.EXTRACAO))
        codigo = (attrs.get('codigo') or '').strip()

        if tipo == TipoPlaca.EXTRACAO and not self.instance:
            if not codigo:
                raise serializers.ValidationError(
                    {'codigo': 'Código é obrigatório para placas de extração.'}
                )
        if codigo:
            qs = Placa.objects.filter(codigo=codigo)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {'codigo': 'Já existe uma placa com este código.'}
                )
            attrs['codigo'] = codigo
        return attrs


class PocoInputSerializer(serializers.Serializer):
    """Entrada de um poço individual no bulk save."""
    posicao = serializers.CharField(max_length=3)
    tipo_conteudo = serializers.ChoiceField(choices=TipoConteudoPoco.choices)
    amostra_codigo = serializers.CharField(
        required=False, allow_blank=True, allow_null=True,
    )
    grupo = serializers.IntegerField(default=1, min_value=1)
