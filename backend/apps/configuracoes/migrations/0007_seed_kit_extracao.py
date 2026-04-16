"""Seed: kits de extração padrão do LACEN."""
from django.db import migrations


def seed_kits(apps, schema_editor):
    KitExtracao = apps.get_model('configuracoes', 'KitExtracao')
    KitExtracao.objects.get_or_create(
        nome='Loccus - Extracta DNA e RNA Viral Fast',
        defaults={'descricao': 'Kit padrão de extração do LACEN/RS.'},
    )


def reverse(apps, schema_editor):
    KitExtracao = apps.get_model('configuracoes', 'KitExtracao')
    KitExtracao.objects.filter(nome='Loccus - Extracta DNA e RNA Viral Fast').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('configuracoes', '0006_kitextracao'),
    ]

    operations = [
        migrations.RunPython(seed_kits, reverse),
    ]
