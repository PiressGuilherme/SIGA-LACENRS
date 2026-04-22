from django.db import migrations, models


def copiar_fk_para_m2m(apps, schema_editor):
    Placa = apps.get_model('placas', 'Placa')
    for placa in Placa.objects.exclude(placa_origem__isnull=True):
        placa.placas_origem.add(placa.placa_origem_id)


def copiar_m2m_para_fk(apps, schema_editor):
    Placa = apps.get_model('placas', 'Placa')
    for placa in Placa.objects.all():
        primeira = placa.placas_origem.order_by('pk').first()
        if primeira is not None:
            placa.placa_origem = primeira
            placa.save(update_fields=['placa_origem'])


class Migration(migrations.Migration):

    dependencies = [
        ('placas', '0012_alter_placa_codigo_help'),
    ]

    operations = [
        migrations.AddField(
            model_name='placa',
            name='placas_origem',
            field=models.ManyToManyField(
                blank=True,
                help_text='Placas de extração usadas como base desta placa PCR (pode ser mais de uma).',
                related_name='placas_pcr_derivadas_new',
                to='placas.placa',
                verbose_name='Placas de extração de origem',
            ),
        ),
        migrations.RunPython(copiar_fk_para_m2m, copiar_m2m_para_fk),
        migrations.RemoveField(
            model_name='placa',
            name='placa_origem',
        ),
        migrations.AlterField(
            model_name='placa',
            name='placas_origem',
            field=models.ManyToManyField(
                blank=True,
                help_text='Placas de extração usadas como base desta placa PCR (pode ser mais de uma).',
                related_name='placas_pcr_derivadas',
                to='placas.placa',
                verbose_name='Placas de extração de origem',
            ),
        ),
    ]
