from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('configuracoes', '0005_seed_ibmp_completo'),
    ]

    operations = [
        migrations.CreateModel(
            name='KitExtracao',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nome', models.CharField(max_length=200, unique=True, verbose_name='Nome')),
                ('descricao', models.TextField(blank=True, verbose_name='Descrição')),
                ('ativo', models.BooleanField(default=True, verbose_name='Ativo')),
                ('criado_em', models.DateTimeField(auto_now_add=True, verbose_name='Criado em')),
                ('atualizado_em', models.DateTimeField(auto_now=True, verbose_name='Atualizado em')),
            ],
            options={
                'verbose_name': 'Kit de extração',
                'verbose_name_plural': 'Kits de extração',
                'ordering': ['nome'],
            },
        ),
    ]
