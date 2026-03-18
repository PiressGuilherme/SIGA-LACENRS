from rest_framework import serializers

from .models import Amostra


class AmostraSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    criado_por_nome = serializers.CharField(
        source='criado_por.nome_completo', read_only=True, default=None,
    )

    class Meta:
        model = Amostra
        fields = '__all__'
        read_only_fields = ('criado_por', 'criado_em', 'atualizado_em')


class AmostraPreviewItemSerializer(serializers.Serializer):
    """Representa uma linha do CSV no preview antes da importação."""
    cod_exame_gal         = serializers.CharField()
    numero_gal            = serializers.CharField()
    cod_amostra_gal       = serializers.CharField(allow_blank=True)
    codigo_interno        = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    nome_paciente         = serializers.CharField()
    nome_social           = serializers.CharField(allow_blank=True)
    cns                   = serializers.CharField(allow_blank=True)
    cpf                   = serializers.CharField(allow_blank=True)
    municipio             = serializers.CharField(allow_blank=True)
    uf                    = serializers.CharField(allow_blank=True)
    unidade_solicitante   = serializers.CharField(allow_blank=True)
    municipio_solicitante = serializers.CharField(allow_blank=True)
    material              = serializers.CharField(allow_blank=True)
    data_coleta           = serializers.DateTimeField(allow_null=True, required=False)
    data_recebimento      = serializers.DateTimeField(allow_null=True, required=False)
    # Calculado pelo endpoint de preview
    _status_importacao    = serializers.ChoiceField(
        choices=['novo', 'duplicado'], read_only=True,
    )


class ImportacaoResultadoSerializer(serializers.Serializer):
    """Retorno do endpoint importar-csv."""
    importadas     = serializers.IntegerField()
    duplicadas     = serializers.IntegerField()
    erros          = serializers.IntegerField()
    detalhes_erros = serializers.ListField(child=serializers.DictField())
