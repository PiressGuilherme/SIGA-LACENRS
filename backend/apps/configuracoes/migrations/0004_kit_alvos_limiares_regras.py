from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('configuracoes', '0003_reacaoprotocolo_margem_percentual'),
    ]

    operations = [
        migrations.CreateModel(
            name='KitAlvo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nome', models.CharField(max_length=100, verbose_name='Nome')),
                ('tipo_alvo', models.CharField(
                    choices=[
                        ('PATOGENO', 'Patógeno'),
                        ('CONTROLE_INTERNO', 'Controle Interno'),
                        ('CONTROLE_EXTERNO', 'Controle Externo'),
                    ],
                    default='PATOGENO', max_length=20, verbose_name='Tipo',
                )),
                ('canal', models.CharField(blank=True, max_length=50, verbose_name='Canal/Fluoróforo')),
                ('ordem', models.PositiveSmallIntegerField(default=0, verbose_name='Ordem')),
                ('kit', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='alvos',
                    to='configuracoes.kitinterpretacao',
                    verbose_name='Kit',
                )),
            ],
            options={
                'verbose_name': 'Alvo do kit',
                'verbose_name_plural': 'Alvos do kit',
                'ordering': ['ordem', 'id'],
                'unique_together': {('kit', 'nome')},
            },
        ),
        migrations.CreateModel(
            name='RegrasLimiar',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('contexto', models.CharField(
                    choices=[
                        ('CP', 'Controle Positivo'),
                        ('CN', 'Controle Negativo'),
                        ('AMOSTRA_POSITIVO', 'Amostra Positivo'),
                    ],
                    max_length=20, verbose_name='Contexto',
                )),
                ('operador', models.CharField(
                    choices=[
                        ('LTE', 'Ct ≤ valor'),
                        ('GTE', 'Ct ≥ valor'),
                        ('SEM_AMP', 'Sem amplificação'),
                    ],
                    default='LTE', max_length=10, verbose_name='Operador',
                )),
                ('ct_limiar', models.FloatField(
                    blank=True, null=True,
                    help_text='Valor do limiar de Cq. Vazio quando operador = SEM_AMP.',
                    verbose_name='Ct limiar',
                )),
                ('alvo', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='limiares',
                    to='configuracoes.kitalvo',
                    verbose_name='Alvo',
                )),
            ],
            options={
                'verbose_name': 'Limiar de Cq',
                'verbose_name_plural': 'Limiares de Cq',
                'unique_together': {('alvo', 'contexto')},
            },
        ),
        migrations.CreateModel(
            name='RegraInterpretacao',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('prioridade', models.PositiveSmallIntegerField(default=10, verbose_name='Prioridade')),
                ('resultado_label', models.CharField(max_length=200, verbose_name='Laudo')),
                ('resultado_codigo', models.CharField(
                    blank=True, max_length=50, verbose_name='Código',
                    help_text='Código interno do resultado (ex: hpv16, hpv_nao_detectado, invalido).',
                )),
                ('tipo_resultado', models.CharField(
                    choices=[
                        ('DETECTADO', 'Detectado'),
                        ('NAO_DETECTADO', 'Não detectado'),
                        ('INVALIDO_ENSAIO', 'Ensaio inválido'),
                        ('INVALIDO_AMOSTRA', 'Amostra inválida'),
                        ('REVISAO_MANUAL', 'Revisão manual necessária'),
                    ],
                    max_length=20, verbose_name='Tipo de resultado',
                )),
                ('condicoes', models.JSONField(
                    help_text=(
                        'Dicionário: chave = nome do alvo ou "CP"/"CN"; '
                        'valor = "POSITIVO" | "NEGATIVO" | "QUALQUER" | "VALIDO" | "INVALIDO".'
                    ),
                    verbose_name='Condições',
                )),
                ('kit', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='regras_interpretacao',
                    to='configuracoes.kitinterpretacao',
                    verbose_name='Kit',
                )),
            ],
            options={
                'verbose_name': 'Regra de interpretação',
                'verbose_name_plural': 'Regras de interpretação',
                'ordering': ['prioridade'],
            },
        ),
    ]
