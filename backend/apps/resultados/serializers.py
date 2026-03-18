from rest_framework import serializers
from .models import ResultadoPoco, ResultadoAmostra

# ----------------------------------------------------------------------------
# Implementados na Fase 4
# ----------------------------------------------------------------------------


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


class ResultadoAmostraSerializer(serializers.ModelSerializer):
    amostra_codigo = serializers.CharField(
        source='poco.amostra.codigo_interno', read_only=True, allow_null=True
    )
    resultado_final_display = serializers.CharField(
        source='get_resultado_final_display', read_only=True
    )

    class Meta:
        model = ResultadoAmostra
        fields = (
            'id', 'poco', 'amostra_codigo',
            'ci_resultado', 'hpv16_resultado', 'hpv18_resultado', 'hpvar_resultado',
            'resultado_final', 'resultado_final_display',
            'imutavel', 'confirmado_em', 'confirmado_por',
        )
        read_only_fields = (
            'id', 'amostra_codigo', 'resultado_final_display',
            'imutavel', 'confirmado_em', 'confirmado_por',
        )


class ResultadoImportSerializer(serializers.Serializer):
    """Serializer para upload do CSV do CFX Manager (Bio-Rad)."""
    arquivo = serializers.FileField()
    placa_id = serializers.IntegerField()
