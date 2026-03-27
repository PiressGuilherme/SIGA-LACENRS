# Generated manually — add 'extracao_confirmada' choice to StatusPlaca

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('placas', '0003_placa_codigo'),
    ]

    operations = [
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
    ]
