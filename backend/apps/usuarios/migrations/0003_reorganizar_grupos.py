# Generated migration to reorganize permission groups

from django.db import migrations


def reorganizar_grupos(apps, schema_editor):
    """
    Reorganiza os grupos de permissão:
    
    Grupos antigos (removidos):
      - extracao
      - pcr
      - admin
      - supervisor (legado)
    
    Grupos novos:
      - tecnico: Consulta, Import CSV, Aliquotagem, Extração, Montagem PCR
      - especialista: Tudo do Técnico + Termociclador + Resultados
      - supervisor: is_staff + is_superuser, acesso total
    """
    Group = apps.get_model('auth', 'Group')
    User = apps.get_model('usuarios', 'Usuario')
    
    # Mapeamento de grupos antigos para novos
    MAPEAMENTO = {
        'extracao': 'tecnico',
        'tecnico': 'tecnico',
        'pcr': 'especialista',
        'especialista': 'especialista',
        'admin': 'supervisor',
        'supervisor': 'supervisor',
    }
    
    # Criar novos grupos se não existirem
    grupos_novos = {}
    for nome in ['tecnico', 'especialista', 'supervisor']:
        grupo, _ = Group.objects.get_or_create(name=nome)
        grupos_novos[nome] = grupo
    
    # Migrar usuários dos grupos antigos para os novos
    for grupo_antigo, grupo_novo in MAPEAMENTO.items():
        try:
            grupo_old = Group.objects.get(name=grupo_antigo)
            usuarios = grupo_old.user_set.all()
            for usuario in usuarios:
                usuario.groups.add(grupos_novos[grupo_novo])
                
                # Se for supervisor, marcar como staff e superuser
                if grupo_novo == 'supervisor':
                    usuario.is_staff = True
                    usuario.is_superuser = True
                    usuario.save(update_fields=['is_staff', 'is_superuser'])
        except Group.DoesNotExist:
            pass
    
    # Remover grupos antigos
    grupos_para_remover = ['extracao', 'pcr', 'admin']
    for nome in grupos_para_remover:
        Group.objects.filter(name=nome).delete()


def reverter_grupos(apps, schema_editor):
    """Reverte a reorganização dos grupos."""
    Group = apps.get_model('auth', 'Group')
    
    # Recriar grupos antigos
    grupos_antigos = ['extracao', 'pcr', 'admin']
    for nome in grupos_antigos:
        Group.objects.get_or_create(name=nome)
    
    # Remover grupos novos
    Group.objects.filter(name__in=['tecnico', 'especialista']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('usuarios', '0002_usuario_numero_cracha'),
    ]

    operations = [
        migrations.RunPython(reorganizar_grupos, reverter_grupos),
    ]