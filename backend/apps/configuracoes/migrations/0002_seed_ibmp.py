"""Seed: cria protocolo IBMP HPV Padrao e kit IBMP Biomol HPV com valores atuais."""
from django.db import migrations


def seed_ibmp(apps, schema_editor):
    ReacaoProtocolo = apps.get_model('configuracoes', 'ReacaoProtocolo')
    ReacaoReagente = apps.get_model('configuracoes', 'ReacaoReagente')
    KitInterpretacao = apps.get_model('configuracoes', 'KitInterpretacao')

    proto, _ = ReacaoProtocolo.objects.get_or_create(
        nome='IBMP HPV Padrao',
        defaults={'descricao': 'Protocolo padrao IBMP para PCR de HPV.', 'ativo': True},
    )
    ReacaoReagente.objects.get_or_create(
        protocolo=proto, nome='Master Mix',
        defaults={'volume_por_reacao': 15.00, 'ordem': 1},
    )
    ReacaoReagente.objects.get_or_create(
        protocolo=proto, nome='Primer Mix',
        defaults={'volume_por_reacao': 5.00, 'ordem': 2},
    )

    KitInterpretacao.objects.get_or_create(
        nome='IBMP Biomol HPV',
        defaults={
            'descricao': 'Kit IBMP Biomol para deteccao de HPV 16, 18 e alto risco.',
            'ativo': True,
            'cq_controle_max': 25.0,
            'cq_amostra_ci_max': 33.0,
            'cq_amostra_hpv_max': 40.0,
        },
    )


def unseed(apps, schema_editor):
    ReacaoProtocolo = apps.get_model('configuracoes', 'ReacaoProtocolo')
    KitInterpretacao = apps.get_model('configuracoes', 'KitInterpretacao')
    ReacaoProtocolo.objects.filter(nome='IBMP HPV Padrao').delete()
    KitInterpretacao.objects.filter(nome='IBMP Biomol HPV').delete()


class Migration(migrations.Migration):
    dependencies = [
        ('configuracoes', '0001_initial'),
    ]
    operations = [
        migrations.RunPython(seed_ibmp, unseed),
    ]
