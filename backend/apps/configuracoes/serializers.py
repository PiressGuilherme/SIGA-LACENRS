from rest_framework import serializers

from .models import (
    KitAlvo, KitInterpretacao, ReacaoProtocolo, ReacaoReagente,
    RegraInterpretacao, RegrasLimiar,
)


# ── Reação ───────────────────────────────────────────────────────────────────

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


# ── Kit de Interpretação ──────────────────────────────────────────────────────

class RegrasLimiarSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegrasLimiar
        fields = ['id', 'contexto', 'operador', 'ct_limiar']


class KitAlvoSerializer(serializers.ModelSerializer):
    limiares = RegrasLimiarSerializer(many=True, required=False)

    class Meta:
        model = KitAlvo
        fields = ['id', 'nome', 'tipo_alvo', 'canal', 'ordem', 'limiares']


class RegraInterpretacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegraInterpretacao
        fields = ['id', 'prioridade', 'resultado_label', 'resultado_codigo', 'tipo_resultado', 'condicoes']


class KitInterpretacaoSerializer(serializers.ModelSerializer):
    alvos = KitAlvoSerializer(many=True, required=False)
    regras_interpretacao = RegraInterpretacaoSerializer(many=True, required=False)

    class Meta:
        model = KitInterpretacao
        fields = [
            'id', 'nome', 'descricao', 'ativo',
            'cq_controle_max', 'cq_amostra_ci_max', 'cq_amostra_hpv_max',
            'alvos', 'regras_interpretacao',
            'criado_em', 'atualizado_em',
        ]
        read_only_fields = ['criado_em', 'atualizado_em']

    def create(self, validated_data):
        alvos_data = validated_data.pop('alvos', [])
        regras_data = validated_data.pop('regras_interpretacao', [])
        kit = KitInterpretacao.objects.create(**validated_data)
        self._sync_alvos(kit, alvos_data)
        self._sync_regras(kit, regras_data)
        return kit

    def update(self, instance, validated_data):
        alvos_data = validated_data.pop('alvos', None)
        regras_data = validated_data.pop('regras_interpretacao', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if alvos_data is not None:
            instance.alvos.all().delete()
            self._sync_alvos(instance, alvos_data)
        if regras_data is not None:
            instance.regras_interpretacao.all().delete()
            self._sync_regras(instance, regras_data)
        return instance

    @staticmethod
    def _sync_alvos(kit, alvos_data):
        for alvo_data in alvos_data:
            limiares_data = alvo_data.pop('limiares', [])
            alvo_data.pop('id', None)
            alvo = KitAlvo.objects.create(kit=kit, **alvo_data)
            for l in limiares_data:
                l.pop('id', None)
                RegrasLimiar.objects.create(alvo=alvo, **l)

    @staticmethod
    def _sync_regras(kit, regras_data):
        for regra_data in regras_data:
            regra_data.pop('id', None)
            RegraInterpretacao.objects.create(kit=kit, **regra_data)
