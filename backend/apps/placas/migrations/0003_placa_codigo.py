# Generated manually — add codigo field to Placa

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('placas', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='placa',
            name='codigo',
            field=models.CharField(
                blank=True, db_index=True,
                help_text='Código de barras gerado automaticamente (ex: PL2603-0001).',
                max_length=20, unique=True,
                verbose_name='Código da Placa',
            ),
            # Temporary: allow blank values for existing rows (if any).
            # The save() override will auto-generate on creation.
            preserve_default=False,
        ),
    ]
