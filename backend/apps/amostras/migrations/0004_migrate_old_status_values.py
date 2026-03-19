"""
Data migration: converte valores de status antigos (pré-refatoração)
para os novos valores do StatusAmostra.

Mapeamento:
  - recebida           → exame_em_analise
  - em_processamento   → extracao
  - amplificada        → resultado
"""

from django.db import migrations


OLD_TO_NEW = {
    'recebida':          'exame_em_analise',
    'em_processamento':  'extracao',
    'amplificada':       'resultado',
}


def forwards(apps, schema_editor):
    Amostra = apps.get_model('amostras', 'Amostra')
    for old_val, new_val in OLD_TO_NEW.items():
        updated = Amostra.objects.filter(status=old_val).update(status=new_val)
        if updated:
            print(f'  {old_val} → {new_val}: {updated} registro(s)')


def backwards(apps, schema_editor):
    Amostra = apps.get_model('amostras', 'Amostra')
    for old_val, new_val in OLD_TO_NEW.items():
        Amostra.objects.filter(status=new_val).update(status=old_val)


class Migration(migrations.Migration):

    dependencies = [
        ('amostras', '0003_alter_amostra_status'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
