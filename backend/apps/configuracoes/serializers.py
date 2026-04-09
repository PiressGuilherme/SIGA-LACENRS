from rest_framework import serializers

from .models import KitInterpretacao, ReacaoProtocolo, ReacaoReagente


class ReacaoReagenteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReacaoReagente
        fields = ['id', 'nome', 'volume_por_reacao', 'ordem']


class ReacaoProtocoloSerializer(serializers.ModelSerializer):
    reagentes = ReacaoReagenteSerializer(many=True)

    class Meta:
        model = ReacaoProtocolo
        fields = ['id', 'nome', 'descricao', 'ativo', 'margem_percentual', 'reagentes', 'criado_em', 'atualizado_em']
        read_only_fields = ['criado_em', 'atualizado_em']

    def create(self, validated_data):
        reagentes_data = validated_data.pop('reagentes', [])
        protocolo = ReacaoProtocolo.objects.create(**validated_data)
        for r in reagentes_data:
            ReacaoReagente.objects.create(protocolo=protocolo, **r)
        return protocolo

    def update(self, instance, validated_data):
        reagentes_data = validated_data.pop('reagentes', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if reagentes_data is not None:
            # Sincroniza reagentes: remove os que nao vieram, atualiza/cria os demais
            ids_recebidos = set()
            for r in reagentes_data:
                r_id = r.get('id')
                if r_id:
                    ReacaoReagente.objects.filter(pk=r_id, protocolo=instance).update(**r)
                    ids_recebidos.add(r_id)
                else:
                    obj = ReacaoReagente.objects.create(protocolo=instance, **r)
                    ids_recebidos.add(obj.pk)
            instance.reagentes.exclude(pk__in=ids_recebidos).delete()

        return instance


class KitInterpretacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = KitInterpretacao
        fields = [
            'id', 'nome', 'descricao', 'ativo',
            'cq_controle_max', 'cq_amostra_ci_max', 'cq_amostra_hpv_max',
            'criado_em', 'atualizado_em',
        ]
        read_only_fields = ['criado_em', 'atualizado_em']
