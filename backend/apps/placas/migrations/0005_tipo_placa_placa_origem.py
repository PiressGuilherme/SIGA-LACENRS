# Generated manually — add tipo_placa and placa_origem to Placa; update status choices and code format

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('placas', '0004_add_extracao_confirmada_status'),
    ]

    operations = [
        # 1. Tipo da placa (extração ou PCR)
        migrations.AddField(
            model_name='placa',
            name='tipo_placa',
            field=models.CharField(
                choices=[('extracao', 'Extração'), ('pcr', 'PCR')],
                default='extracao',
                db_index=True,
                max_length=10,
                verbose_name='Tipo de placa',
            ),
        ),
        # 2. Placa de origem (para placas PCR derivadas de extração)
        migrations.AddField(
            model_name='placa',
            name='placa_origem',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='placas_pcr_derivadas',
                to='placas.placa',
                verbose_name='Placa de extração de origem',
            ),
        ),
        # 3. Atualizar choices do status_placa (max_length continua 30)
        migrations.AlterField(
            model_name='placa',
            name='status_placa',
            field=models.CharField(
                choices=[
                    ('aberta', 'Aberta'),
                    ('extracao_confirmada', 'Extração confirmada'),
                    ('submetida', 'Submetida ao termociclador'),
                    ('resultados_importados', 'Resultados importados'),
                ],
                db_index=True,
                default='aberta',
                max_length=30,
                verbose_name='Status da placa',
            ),
        ),
        # 4. Aumentar max_length do codigo para acomodar novo formato HPV{DDMMAA}-{N}
        migrations.AlterField(
            model_name='placa',
            name='codigo',
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text='Gerado automaticamente no formato HPV{DDMMAA}-{N} (ex: HPV240326-1).',
                max_length=20,
                unique=True,
                verbose_name='Código da Placa',
            ),
        ),
    ]
