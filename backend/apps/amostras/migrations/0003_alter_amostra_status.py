# Generated manually — refactoring of StatusAmostra to reflect GAL statuses

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('amostras', '0002_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='amostra',
            name='status',
            field=models.CharField(
                choices=[
                    ('aguardando_triagem',   'Aguardando Triagem'),
                    ('exame_em_analise',     'Exame em Análise'),
                    ('aliquotada',           'Aliquotada'),
                    ('extracao',             'Extração'),
                    ('extraida',             'Extraída'),
                    ('resultado',            'Resultado'),
                    ('resultado_liberado',   'Resultado Liberado'),
                    ('cancelada',            'Cancelada'),
                    ('repeticao_solicitada', 'Repetição Solicitada'),
                ],
                db_index=True,
                default='aguardando_triagem',
                max_length=30,
                verbose_name='Status',
            ),
        ),
    ]
