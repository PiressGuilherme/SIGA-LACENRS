"""
Seed: configura o kit IBMP Biomol HPV com alvos, limiares e regras de interpretação.

Alvos:
  CI     — Controle Interno  (Cy5)   — limiar AMOSTRA_POSITIVO: Cq ≤ 33
  HPV16  — Patógeno          (FAM)   — limiar AMOSTRA_POSITIVO: Cq ≤ 40
  HPV18  — Patógeno          (VIC)   — limiar AMOSTRA_POSITIVO: Cq ≤ 40
  HPV_AR — Patógeno          (ROX)   — limiar AMOSTRA_POSITIVO: Cq ≤ 40

Limiares de controle (todos os alvos):
  CP: Cq ≤ 25
  CN CI: Cq ≤ 25 | CN HPV*: sem amplificação

Regras de interpretação (11 laudos):
  Prioridade 1-2:  ensaio inválido (CP ou CN falhou)
  Prioridade 3:    amostra inválida (sem CI, sem HPV)
  Prioridade 10:   HPV não detectável
  Prioridades 20-26: detectados simples e coinfeções
"""
from django.db import migrations


def seed_ibmp_completo(apps, schema_editor):
    KitInterpretacao = apps.get_model('configuracoes', 'KitInterpretacao')
    KitAlvo = apps.get_model('configuracoes', 'KitAlvo')
    RegrasLimiar = apps.get_model('configuracoes', 'RegrasLimiar')
    RegraInterpretacao = apps.get_model('configuracoes', 'RegraInterpretacao')

    kit = KitInterpretacao.objects.filter(nome='IBMP Biomol HPV').first()
    if not kit:
        return

    # ── Alvos ────────────────────────────────────────────────────────────────
    alvos_cfg = [
        ('CI',     'CONTROLE_INTERNO', 'Cy5', 0),
        ('HPV16',  'PATOGENO',         'FAM', 1),
        ('HPV18',  'PATOGENO',         'VIC', 2),
        ('HPV_AR', 'PATOGENO',         'ROX', 3),
    ]
    alvos = {}
    for nome, tipo, canal, ordem in alvos_cfg:
        alvo, _ = KitAlvo.objects.get_or_create(
            kit=kit, nome=nome,
            defaults={'tipo_alvo': tipo, 'canal': canal, 'ordem': ordem},
        )
        alvos[nome] = alvo

    # ── Limiares ──────────────────────────────────────────────────────────────
    # (alvo_nome, contexto, operador, ct_limiar)
    limiares_cfg = [
        # Controle Positivo: todos os 4 alvos devem ter Cq ≤ 25
        ('CI',     'CP', 'LTE', 25.0),
        ('HPV16',  'CP', 'LTE', 25.0),
        ('HPV18',  'CP', 'LTE', 25.0),
        ('HPV_AR', 'CP', 'LTE', 25.0),
        # Controle Negativo: CI deve amplificar (≤ 25), HPVs não devem amplificar
        ('CI',     'CN', 'LTE',     25.0),
        ('HPV16',  'CN', 'SEM_AMP', None),
        ('HPV18',  'CN', 'SEM_AMP', None),
        ('HPV_AR', 'CN', 'SEM_AMP', None),
        # Amostra — threshold de positividade por alvo
        ('CI',     'AMOSTRA_POSITIVO', 'LTE', 33.0),
        ('HPV16',  'AMOSTRA_POSITIVO', 'LTE', 40.0),
        ('HPV18',  'AMOSTRA_POSITIVO', 'LTE', 40.0),
        ('HPV_AR', 'AMOSTRA_POSITIVO', 'LTE', 40.0),
    ]
    for alvo_nome, contexto, operador, ct in limiares_cfg:
        RegrasLimiar.objects.get_or_create(
            alvo=alvos[alvo_nome], contexto=contexto,
            defaults={'operador': operador, 'ct_limiar': ct},
        )

    # ── Regras de Interpretação ───────────────────────────────────────────────
    # Q = QUALQUER, P = POSITIVO, N = NEGATIVO, V = VALIDO, I = INVALIDO
    Q, P, N, V, I = 'QUALQUER', 'POSITIVO', 'NEGATIVO', 'VALIDO', 'INVALIDO'

    regras_cfg = [
        # (prioridade, label, codigo, tipo, condicoes)
        (1,  'Ensaio inválido (CN falhou)',  'invalido', 'INVALIDO_ENSAIO',
         {'CI': Q, 'HPV16': Q, 'HPV18': Q, 'HPV_AR': Q, 'CP': Q, 'CN': I}),
        (2,  'Ensaio inválido (CP falhou)',  'invalido', 'INVALIDO_ENSAIO',
         {'CI': Q, 'HPV16': Q, 'HPV18': Q, 'HPV_AR': Q, 'CP': I, 'CN': Q}),
        (3,  'Amostra inválida',             'invalido', 'INVALIDO_AMOSTRA',
         {'CI': N, 'HPV16': N, 'HPV18': N, 'HPV_AR': N, 'CP': V, 'CN': V}),
        (10, 'HPV não detectável',           'hpv_nao_detectado', 'NAO_DETECTADO',
         {'CI': P, 'HPV16': N, 'HPV18': N, 'HPV_AR': N, 'CP': V, 'CN': V}),
        (20, 'HPV-16 detectável',            'hpv16',       'DETECTADO',
         {'CI': Q, 'HPV16': P, 'HPV18': N, 'HPV_AR': N, 'CP': V, 'CN': V}),
        (21, 'HPV-18 detectável',            'hpv18',       'DETECTADO',
         {'CI': Q, 'HPV16': N, 'HPV18': P, 'HPV_AR': N, 'CP': V, 'CN': V}),
        (22, 'HPV AR detectável',            'hpv_ar',      'DETECTADO',
         {'CI': Q, 'HPV16': N, 'HPV18': N, 'HPV_AR': P, 'CP': V, 'CN': V}),
        (23, 'HPV-18 e HPV AR detectáveis',  'hpv18_ar',    'DETECTADO',
         {'CI': Q, 'HPV16': N, 'HPV18': P, 'HPV_AR': P, 'CP': V, 'CN': V}),
        (24, 'HPV-16 e HPV AR detectáveis',  'hpv16_ar',    'DETECTADO',
         {'CI': Q, 'HPV16': P, 'HPV18': N, 'HPV_AR': P, 'CP': V, 'CN': V}),
        (25, 'HPV-16 e HPV-18 detectáveis',  'hpv16_18',    'DETECTADO',
         {'CI': Q, 'HPV16': P, 'HPV18': P, 'HPV_AR': N, 'CP': V, 'CN': V}),
        (26, 'HPV-16, HPV-18 e HPV AR detectáveis', 'hpv16_18_ar', 'DETECTADO',
         {'CI': Q, 'HPV16': P, 'HPV18': P, 'HPV_AR': P, 'CP': V, 'CN': V}),
    ]
    for prioridade, label, codigo, tipo, condicoes in regras_cfg:
        RegraInterpretacao.objects.get_or_create(
            kit=kit, prioridade=prioridade,
            defaults={
                'resultado_label': label,
                'resultado_codigo': codigo,
                'tipo_resultado': tipo,
                'condicoes': condicoes,
            },
        )


def desfazer(apps, schema_editor):
    KitInterpretacao = apps.get_model('configuracoes', 'KitInterpretacao')
    KitAlvo = apps.get_model('configuracoes', 'KitAlvo')
    RegraInterpretacao = apps.get_model('configuracoes', 'RegraInterpretacao')
    kit = KitInterpretacao.objects.filter(nome='IBMP Biomol HPV').first()
    if kit:
        KitAlvo.objects.filter(kit=kit).delete()
        RegraInterpretacao.objects.filter(kit=kit).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('configuracoes', '0004_kit_alvos_limiares_regras'),
    ]

    operations = [
        migrations.RunPython(seed_ibmp_completo, desfazer),
    ]
