from rest_framework import serializers

from .models import ResultadoPoco, ResultadoAmostra


class ResultadoPocoSerializer(serializers.ModelSerializer):
    interpretacao_efetiva = serializers.ReadOnlyField()

    class Meta:
        model = ResultadoPoco
        fields = (
            'id', 'poco', 'canal', 'cq',
            'interpretacao', 'interpretacao_manual', 'justificativa_manual',
            'interpretacao_efetiva',
        )
        read_only_fields = ('id', 'poco', 'canal', 'cq', 'interpretacao', 'interpretacao_efetiva')

    def validate(self, data):
        interp_manual = data.get('interpretacao_manual')
        # Ao limpar o override (null/'') não exige justificativa
        if interp_manual:
            justificativa = data.get(
                'justificativa_manual',
                getattr(self.instance, 'justificativa_manual', '') or '',
            )
            if not justificativa.strip():
                raise serializers.ValidationError(
                    {'justificativa_manual': 'Justificativa é obrigatória ao editar a interpretação.'}
                )
        return data


class ResultadoAmostraSerializer(serializers.ModelSerializer):
    amostra_codigo = serializers.CharField(
        source='poco.amostra.codigo_interno', read_only=True, allow_null=True,
    )
    resultado_final_display = serializers.CharField(
        source='get_resultado_final_display', read_only=True,
    )
    confirmado_por_nome = serializers.SerializerMethodField()

    class Meta:
        model = ResultadoAmostra
        fields = (
            'id', 'poco', 'amostra_codigo',
            'ci_resultado', 'hpv16_resultado', 'hpv18_resultado', 'hpvar_resultado',
            'resultado_final', 'resultado_final_display',
            'imutavel', 'confirmado_em', 'confirmado_por', 'confirmado_por_nome',
        )
        read_only_fields = (
            'id', 'amostra_codigo', 'resultado_final_display',
            'imutavel', 'confirmado_em', 'confirmado_por', 'confirmado_por_nome',
        )

    def get_confirmado_por_nome(self, obj):
        if obj.confirmado_por:
            return obj.confirmado_por.get_full_name() or obj.confirmado_por.email
        return None


class ResultadoAmostraDetalheSerializer(ResultadoAmostraSerializer):
    """ResultadoAmostra com canais aninhados para a tela de revisão."""
    canais = ResultadoPocoSerializer(source='poco.resultados', many=True, read_only=True)

    class Meta(ResultadoAmostraSerializer.Meta):
        fields = ResultadoAmostraSerializer.Meta.fields + ('canais',)


class ResultadoImportSerializer(serializers.Serializer):
    """Serializer para upload do CSV do CFX Manager (Bio-Rad)."""
    arquivo = serializers.FileField()
    placa_id = serializers.IntegerField()
