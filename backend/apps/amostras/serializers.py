from rest_framework import serializers
from .models import Amostra

# ----------------------------------------------------------------------------
# Implementados na Fase 2
# ----------------------------------------------------------------------------


class AmostraSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Amostra
        fields = (
            'id', 'numero_gal', 'codigo_interno',
            'data_coleta', 'data_recebimento',
            'sexo', 'idade', 'municipio', 'cid',
            'status', 'status_display', 'observacoes',
            'criado_em', 'atualizado_em',
        )
        read_only_fields = ('id', 'status_display', 'criado_em', 'atualizado_em')


class AmostraImportSerializer(serializers.Serializer):
    """Serializer para upload do CSV do GAL com preview de validação."""
    arquivo = serializers.FileField()
