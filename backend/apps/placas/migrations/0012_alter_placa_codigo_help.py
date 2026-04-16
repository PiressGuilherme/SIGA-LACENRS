from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('placas', '0011_placa_kit_extracao'),
    ]

    operations = [
        migrations.AlterField(
            model_name='placa',
            name='codigo',
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text='Extração: informado pelo usuário ao criar a placa. PCR: gerado automaticamente no formato HPVp{DDMMAA}-{N} (ex: HPVp010426-1).',
                max_length=20,
                unique=True,
                verbose_name='Código da Placa',
            ),
        ),
    ]
