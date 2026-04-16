from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('placas', '0010_placa_kit_interpretacao'),
        ('configuracoes', '0006_kitextracao'),
    ]

    operations = [
        migrations.AddField(
            model_name='placa',
            name='kit_extracao',
            field=models.ForeignKey(
                blank=True,
                help_text='Kit de extração usado nesta placa (aparece no mapa de trabalho).',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='configuracoes.kitextracao',
                verbose_name='Kit de extração',
            ),
        ),
    ]
