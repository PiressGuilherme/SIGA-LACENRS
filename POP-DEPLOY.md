# POP — Procedimento Operacional Padrão
## Deploy e Atualização do SIGA-LACEN

**Documento:** POP-TI-001  
**Sistema:** SIGA-LACEN — Sistema de Informação e Gerenciamento de Amostras  
**Unidade:** LACEN-RS / CEVS  
**Elaborado por:** Equipe LSG 
**Revisão:** 02  

---

## 1. Objetivo

Descrever o procedimento completo para instalação inicial e atualização do SIGA-LACEN no servidor Linux do laboratório, garantindo que o sistema seja implantado de forma padronizada, rastreável e com mínimo de interrupção.

---

## 2. Pré-requisitos

### 2.1 Softwares necessários no servidor

| Software | Versão mínima | Verificação |
|---|---|---|
| Docker Engine | 24.x | `docker --version` |
| Docker Compose (plugin) | 2.x | `docker compose version` |
| Git | 2.x | `git --version` |
| mkcert | 1.4.x | `mkcert --version` |

### 2.2 Acesso necessário

- Acesso SSH ao servidor (usuário com permissão `sudo` ou no grupo `docker`)
- Acesso de leitura ao repositório Git: `https://github.com/PiressGuilherme/SIGA-LACENRS`
- Branch de produção: `main`

### 2.3 Rede

- Servidor com IP fixo na LAN do laboratório
- Resolução de nome via **mDNS (Avahi)** — não requer configuração de roteador
  - O servidor anuncia `siga.local` automaticamente na rede local
  - Windows 10/11 e Linux resolvem sem configuração adicional
- Portas liberadas no servidor: `80` (HTTP → redireciona para HTTPS) e `443` (HTTPS)

---

## 3. Instalação Inicial (Primeira vez)

> Execute este procedimento somente na primeira implantação. Para atualizações, siga a **Seção 4**.

### Passo 1 — Clonar o repositório

```bash
cd /opt
sudo git clone https://github.com/PiressGuilherme/SIGA-LACENRS.git siga-lacen
sudo chown -R $USER:$USER /opt/siga-lacen
cd /opt/siga-lacen
```

### Passo 2 — Criar o arquivo de variáveis de ambiente

```bash
cp .env.example .env
nano .env
```

Preencher obrigatoriamente:

| Variável | Descrição | Exemplo |
|---|---|---|
| `SECRET_KEY` | Chave secreta Django (50+ chars aleatórios) | `python3 -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DB_PASSWORD` | Senha do banco PostgreSQL | senha forte, sem caracteres especiais do shell |
| `ALLOWED_HOSTS` | Hosts aceitos pelo Django | `siga.local,localhost,<IP-DO-SERVIDOR>` |
| `CORS_ALLOWED_ORIGINS` | Origens da API | `https://siga.local,https://<IP-DO-SERVIDOR>` |

> **Nunca versione o arquivo `.env`.** Ele contém credenciais sensíveis.

### Passo 3 — Configurar mDNS (Avahi)

O servidor usa Avahi para anunciar `siga.local` na rede local sem necessidade de servidor DNS externo.

```bash
# Instalar (se ainda não estiver instalado)
sudo apt install avahi-daemon

# Configurar o nome mDNS e a interface de rede correta
# Descubra a interface LAN do servidor (ex: eno1, eth0):
ip -o -4 addr show | grep -v '127\.\|172\.\|10\.0\.' | awk '{print $2, $4}'

# Editar a configuração do Avahi
sudo nano /etc/avahi/avahi-daemon.conf
```

Alterar as seguintes linhas (descomentar e preencher):
```ini
host-name=siga
allow-interfaces=eno1   # substituir pelo nome da interface LAN
```

```bash
sudo systemctl restart avahi-daemon

# Verificar que o nome está sendo anunciado com o IP correto
avahi-resolve --name siga.local
```

> **Para alterar o nome mDNS no futuro:** editar `host-name=` no arquivo acima, reiniciar o avahi-daemon, reger o certificado e atualizar o `.env`. Veja a Seção 6.6.

### Passo 4 — Gerar certificados HTTPS locais

```bash
# Instalar a CA raiz no sistema (executar uma única vez por máquina)
mkcert -install

# Obter o IP do servidor
IP_SERVIDOR=$(hostname -I | awk '{print $1}')

# Gerar certificado para o domínio local e IP
cd docker/nginx/certs
mkcert siga.local localhost 127.0.0.1 $IP_SERVIDOR
# Renomear para o padrão esperado pelo Nginx
mv siga.local+3.pem     siga.local.pem
mv siga.local+3-key.pem siga.local-key.pem
cd ../../..
```

> O arquivo `rootCA.pem` gerado pelo mkcert deve ser instalado nos browsers dos computadores clientes. Veja o Anexo A.

### Passo 5 — Build e subida dos containers

> **IMPORTANTE:** O repositório contém dois arquivos de composição:
> - `docker-compose.yml` — **produção** (Gunicorn + Nginx HTTPS)
> - `docker-compose.dev.yml` — **desenvolvimento** (runserver + Vite HMR + portas expostas)
>
> Em produção, **nunca** use o arquivo de dev. Use apenas `-f docker-compose.yml`.

```bash
# Build das imagens (inclui compilação do frontend React)
docker compose -f docker-compose.yml build

# Subir todos os serviços em background (produção)
docker compose -f docker-compose.yml up -d

# OU, para desenvolvimento local:
# docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

O `entrypoint.sh` executa automaticamente na primeira subida:
- `migrate` — cria todas as tabelas no banco
- `loaddata fixtures/grupos_iniciais.json` — cria os grupos de perfil (`tecnico`, `especialista`, `supervisor`)
- `collectstatic` — copia os arquivos estáticos para o volume Nginx

### Passo 6 — Criar o superusuário administrador

```bash
docker compose exec backend python manage.py createsuperuser
```

Informar: e-mail, nome completo e senha. Este usuário terá acesso total ao Django Admin (`/admin/`).

### Passo 7 — Verificar funcionamento

```bash
# Ver logs de todos os containers
docker compose logs -f

# Verificar se todos os containers estão Up
docker compose ps
```

Acessar no browser: `https://siga.local`  
Login: e-mail e senha do superusuário criado no Passo 6.

---

## 4. Atualização (Deploy de nova versão)

> Procedimento padrão a cada nova release ou atualização do código.

### Passo 1 — Comunicar a manutenção

Avisar os usuários do laboratório que o sistema ficará indisponível por aproximadamente **5 minutos**.

### Passo 2 — Conectar ao servidor

```bash
ssh usuario@<IP-DO-SERVIDOR>
cd /opt/siga-lacen
```

### Passo 3 — Atualizar o código

```bash
git fetch origin
git status        # confirmar que não há alterações locais não commitadas
git pull origin main
```

> Se houver conflitos ou alterações locais, resolver antes de continuar.

### Passo 4 — Reconstruir e reiniciar

```bash
# Rebuild das imagens com o novo código (produção)
docker compose -f docker-compose.yml build

# Reiniciar os containers (zero-downtime não garantido — avisar usuários)
docker compose -f docker-compose.yml up -d
```

O `entrypoint.sh` aplica automaticamente as migrations e atualiza os estáticos.

### Passo 5 — Verificar migrations e logs

```bash
# Acompanhar inicialização
docker compose logs -f backend

# Confirmar que não há erros
docker compose ps
```

Saída esperada: todos os containers com status `Up`.

### Passo 6 — Testar o sistema

- [ ] Acessar `https://siga.local/login/`
- [ ] Fazer login com um usuário de cada perfil (`tecnico`, `especialista`, `supervisor`)
- [ ] Navegar pelas telas principais (Início, Consulta, Extração, PCR, Resultados)
- [ ] Confirmar que não há erros no console do browser

---

## 5. Rollback (reverter para versão anterior)

Se a atualização causar falha crítica:

### Opção A — Reverter o último commit (preferível)

```bash
# Ver histórico de commits
git log --oneline -10

# Reverter as mudanças do último commit (cria um novo commit de reversão)
git revert --no-commit HEAD
git commit -m "Rollback: reverter último deploy"

# Reconstruir com a versão anterior
docker compose -f docker-compose.yml build
docker compose -f docker-compose.yml up -d
```

### Opção B — Voltar para commit específico (casos graves)

```bash
# Criar branch de rollback a partir do commit desejado
git checkout -b rollback/$(date +%Y%m%d) <HASH>

# Reconstruir com a versão anterior
docker compose -f docker-compose.yml build
docker compose -f docker-compose.yml up -d
```

> **Atenção:** Nunca use `git checkout <HASH>` diretamente (sem `-b`) pois cria um estado "detached HEAD".

> Se a nova versão criou migrations de banco que precisam ser revertidas:
> ```bash
> docker compose exec backend python manage.py migrate <app> <migration_anterior>
> ```
> Exemplo: `python manage.py migrate placas 0008`

---

## 6. Procedimentos de Manutenção

### 6.1 Criar novo usuário de laboratório

```bash
# Via Django Admin (recomendado)
# Acessar https://siga.local/admin/ → Usuários → Adicionar
# Informar: e-mail, nome completo, número do crachá, grupo de perfil

# Ou via terminal
docker compose exec backend python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
u = User.objects.create_user(
    email='usuario@lacen.rs.gov.br',
    password='senha_temporaria',
    nome_completo='Nome Completo',
    numero_cracha='12345'
)
print('Criado:', u.email)
"
```

### 6.2 Resetar senha de usuário

```bash
docker compose exec backend python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
u = User.objects.get(email='usuario@lacen.rs.gov.br')
u.set_password('nova_senha')
u.save()
print('Senha alterada.')
"
```

### 6.3 Backup automatizado

O sistema possui backup automatizado via script + cron. Os backups são armazenados em `/mnt/HD/cdctserver/siga-backups/` e sincronizados para o Google Drive pelo rclone.

**O que é salvo:**

| Item | Formato | Frequência | Retenção |
|------|---------|------------|----------|
| Banco PostgreSQL | `pg_dump -Fc` (custom comprimido) | Diário 01:30 | 30 dias |
| Media files (uploads) | `tar.gz` do volume Docker | Diário 01:30 | 30 dias |
| Config (.env + certs) | `tar.gz` | Diário 01:30 | 30 dias |

**Cron configurado:**

```bash
# SIGA-LACEN: backup diário às 01:30
30 1 * * * /home/cdctserver/SIGA-LACENRS/scripts/backup.sh >> /mnt/HD/cdctserver/siga-backups/cron.log 2>&1

# rclone sync: sincroniza HDD para Google Drive às 02:00 (inclui os backups)
0 2 * * * /usr/bin/rclone sync --progress /mnt/HD/cdctserver gdrive:/server/ >> /home/cdctserver/rclone_sync.log 2>&1
```

**Backup manual (sob demanda):**

```bash
# Executar o script de backup manualmente
/home/cdctserver/SIGA-LACENRS/scripts/backup.sh

# Verificar resultado
tail -10 /mnt/HD/cdctserver/siga-backups/backup.log
ls -lh /mnt/HD/cdctserver/siga-backups/ | tail -5
```

**Restaurar banco de dados:**

```bash
# Listar backups disponíveis
ls -lh /mnt/HD/cdctserver/siga-backups/db_*.dump

# Restaurar (substitua a data pelo backup desejado)
docker compose exec -T db pg_restore -U siga_user -d siga_lacen --clean --if-exists \
    < /mnt/HD/cdctserver/siga-backups/db_YYYYMMDD_HHMM.dump
```

**Restaurar media files:**

```bash
docker run --rm \
    -v siga-lacenrs_media_files:/data \
    -v /mnt/HD/cdctserver/siga-backups:/backup:ro \
    alpine sh -c "rm -rf /data/* && tar xzf /backup/media_YYYYMMDD_HHMM.tar.gz -C /data"
```

**Restaurar configuração (.env + certificados):**

```bash
tar xzf /mnt/HD/cdctserver/siga-backups/config_YYYYMMDD_HHMM.tar.gz -C /home/cdctserver/SIGA-LACENRS/
```

### 6.4 Ver logs de auditoria

```bash
# Logs do Django (erros de aplicação)
docker compose logs backend --since 24h

# Auditoria de alterações em registros (via Django Admin)
# Acessar: https://siga.local/admin/auditlog/logentry/
```

### 6.5 Reiniciar apenas um container

```bash
docker compose restart backend    # reinicia só o backend
docker compose restart nginx      # reinicia só o Nginx
```

### 6.6 Alterar o nome mDNS (`siga.local` → outro nome)

```bash
# 1. Editar o nome no Avahi
sudo nano /etc/avahi/avahi-daemon.conf
# Alterar: host-name=novo-nome
sudo systemctl restart avahi-daemon

# 2. Reger o certificado
IP_SERVIDOR=$(hostname -I | awk '{print $1}')
cd /opt/siga-lacen/docker/nginx/certs
rm *.pem
mkcert novo-nome.local localhost 127.0.0.1 $IP_SERVIDOR
mv novo-nome.local+3.pem     novo-nome.local.pem
mv novo-nome.local+3-key.pem novo-nome.local-key.pem
cd ../../..

# 3. Atualizar nginx.conf (ssl_certificate e ssl_certificate_key)
nano docker/nginx/nginx.conf

# 4. Atualizar .env.prod e copiar para .env
nano .env.prod   # ALLOWED_HOSTS e CORS_ALLOWED_ORIGINS
cp .env.prod .env

# 5. Rebuild e reiniciar
docker compose -f docker-compose.yml build nginx
docker compose -f docker-compose.yml up -d

# 6. Verificar
avahi-resolve --name novo-nome.local
```

---

## 7. Estrutura dos Containers em Produção

```
┌─────────────────────────────────────────────────┐
│                   Host Linux                    │
│                                                 │
│  ┌──────────┐   porta 80/443                    │
│  │  Nginx   │◄──────────────────── Browser      │
│  │ (proxy)  │                     do usuário    │
│  └────┬─────┘                                   │
│       │ proxy_pass :8000                        │
│  ┌────▼──────────┐   ┌──────────────┐           │
│  │    Backend    │   │      DB      │           │
│  │ Django+Gunicorn│◄─►│ PostgreSQL  │           │
│  │   (porta 8000)│   │  (porta 5432)│           │
│  └───────────────┘   └──────────────┘           │
│                                                 │
│  Volumes persistentes:                          │
│    postgres_data  → dados do banco              │
│    static_files   → JS/CSS compilados           │
│    media_files    → uploads                     │
└─────────────────────────────────────────────────┘
```

---

## 8. Variáveis de Ambiente — Referência Completa

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SECRET_KEY` | Sim | Chave criptográfica do Django. Gerar com `secrets.token_urlsafe(50)`. |
| `DEBUG` | Sim | `False` em produção. Nunca `True` em servidor real. |
| `ALLOWED_HOSTS` | Sim | Lista separada por vírgula dos hosts aceitos. |
| `CORS_ALLOWED_ORIGINS` | Sim | Origens permitidas na API (com protocolo). |
| `DB_NAME` | Sim | Nome do banco PostgreSQL (`siga_lacen`). |
| `DB_USER` | Sim | Usuário do banco (`siga_user`). |
| `DB_PASSWORD` | Sim | Senha do banco. Usar senha forte. |
| `DB_HOST` | Sim | Host do banco. Em Docker: `db`. |
| `DB_PORT` | Sim | Porta do banco: `5432`. |
| `DJANGO_SETTINGS_MODULE` | Sim | `config.settings.production` em produção. |
| `GAL_WS_USUARIO` | Não | Usuário do WebService GAL (se integração ativa). |
| `GAL_WS_SENHA` | Não | Senha do WebService GAL. |
| `GAL_WS_URL` | Não | URL do WebService GAL. |
| `GAL_WS_VERIFY_SSL` | Não | `True` para verificar SSL do GAL (padrão). |

---

## 9. Manutenção Docker

### 9.1 Limpeza de cache e imagens

O Docker acumula cache de build e imagens antigas que ocupam espaço. Executar **mensalmente**:

```bash
# Ver uso de disco do Docker
docker system df

# Limpar cache de build com mais de 7 dias
docker builder prune --filter "until=168h" -f

# Remover imagens não usadas com mais de 30 dias
docker image prune -a --filter "until=720h" -f
```

### 9.2 Verificação de saúde dos containers

```bash
# Status de todos os containers
docker compose ps

# Verificar endpoint de saúde do backend
curl -sk https://siga.local/api/health/
# Resposta esperada: {"status": "ok", "db": "ok"}
```

---

## 10. Monitoramento

### 10.1 Espaço em disco

Verificar **semanalmente**:

```bash
# Disco do sistema e HDD de backups
df -h / /mnt/HD

# Espaço usado pelo Docker
docker system df

# Tamanho dos backups
du -sh /mnt/HD/cdctserver/siga-backups/
```

### 10.2 Logs do backend

```bash
# Erros nas últimas 24h
docker compose logs backend --since 24h 2>&1 | grep -i "error\|traceback"

# Todos os logs das últimas 24h
docker compose logs backend --since 24h
```

### 10.3 Logs de backup

```bash
# Últimas entradas do log de backup
tail -20 /mnt/HD/cdctserver/siga-backups/backup.log

# Verificar se backups recentes existem
ls -lh /mnt/HD/cdctserver/siga-backups/db_*.dump | tail -7

# Verificar log do rclone (sync para Google Drive)
tail -20 /home/cdctserver/rclone_sync.log
```

### 10.4 Auditoria de alterações

Acessar via Django Admin: `https://siga.local/admin/auditlog/logentry/`

---

## 11. Atualização de Pacotes do Sistema

Executar **mensalmente**, preferencialmente fora do horário de uso:

```bash
# 1. Verificar atualizações disponíveis
sudo apt update && sudo apt list --upgradable

# 2. Aplicar atualizações
sudo apt upgrade -y

# 3. Reiniciar apenas se o kernel foi atualizado
# (verificar se apareceu "linux-image" na lista de atualizados)
sudo reboot  # somente se necessário
```

> **Docker Engine:** Seguir o procedimento oficial em https://docs.docker.com/engine/install/ubuntu/ para atualizações do Docker.

---

## 12. Disaster Recovery — Recuperação Completa

Procedimento para restaurar o SIGA-LACEN em um **novo servidor** a partir dos backups.

### Pré-requisitos
- Servidor Ubuntu com Docker, Git, mkcert e avahi-daemon instalados (Seção 2)
- Acesso aos backups em `/mnt/HD/cdctserver/siga-backups/` ou no Google Drive

### Passo 1 — Clonar o repositório

```bash
cd /opt
sudo git clone https://github.com/PiressGuilherme/SIGA-LACENRS.git siga-lacen
sudo chown -R $USER:$USER /opt/siga-lacen
cd /opt/siga-lacen
```

### Passo 2 — Restaurar configuração

```bash
# Restaurar .env e certificados do backup mais recente
tar xzf /mnt/HD/cdctserver/siga-backups/config_YYYYMMDD_HHMM.tar.gz -C /opt/siga-lacen/
```

### Passo 3 — Subir a stack (sem dados)

```bash
docker compose -f docker-compose.yml build
docker compose -f docker-compose.yml up -d
```

### Passo 4 — Restaurar o banco de dados

```bash
# Aguardar o banco inicializar, depois restaurar o dump
docker compose exec -T db pg_restore -U siga_user -d siga_lacen --clean --if-exists \
    < /mnt/HD/cdctserver/siga-backups/db_YYYYMMDD_HHMM.dump
```

### Passo 5 — Restaurar media files

```bash
docker run --rm \
    -v siga-lacenrs_media_files:/data \
    -v /mnt/HD/cdctserver/siga-backups:/backup:ro \
    alpine sh -c "rm -rf /data/* && tar xzf /backup/media_YYYYMMDD_HHMM.tar.gz -C /data"
```

### Passo 6 — Verificar

```bash
docker compose ps                              # todos os containers Up
curl -sk https://siga.local/api/health/        # {"status": "ok", "db": "ok"}
```

Acessar `https://siga.local` e fazer login para confirmar que os dados foram restaurados.

---

## 13. Plano de Manutenção Periódica

### Diário (automatizado)
- [x] Backup do banco, media e config às 01:30 (`scripts/backup.sh`)
- [x] Sincronização para Google Drive às 02:00 (rclone)

### Semanal (manual, ~10 min)
- [ ] Verificar integridade dos backups (Seção 10.3)
- [ ] Verificar espaço em disco (Seção 10.1)
- [ ] Verificar saúde dos containers (Seção 9.2)
- [ ] Verificar erros do backend (Seção 10.2)

### Mensal (manual, ~30 min, primeira segunda-feira do mês)
- [ ] Todas as verificações semanais
- [ ] Limpeza Docker — cache e imagens (Seção 9.1)
- [ ] Atualizações do sistema operacional (Seção 11)
- [ ] Revisar audit log (Seção 10.4)
- [ ] Verificar rclone sync (Seção 10.3)

### Trimestral (manual, ~1 hora)
- [ ] Todas as verificações mensais
- [ ] Revisar dependências Python: `docker compose exec backend pip list --outdated`
- [ ] Dry-run de disaster recovery (Seção 12), se possível
- [ ] Revisar este POP para acurácia
- [ ] Revisar contas de usuário — desativar inativos

---

## Anexo A — Instalação do Certificado nos Clientes Windows

Para que o browser aceite o HTTPS local sem aviso de segurança, instale o certificado raiz do mkcert em cada computador cliente:

1. Copiar o arquivo `rootCA.pem` do servidor para o computador cliente
   - Localização no servidor: `~/.local/share/mkcert/rootCA.pem`
2. No Windows, renomear para `rootCA.crt`
3. Duplo-clique no arquivo → **Instalar Certificado**
4. Selecionar **Computador Local** → **Autoridades de Certificação Raiz Confiáveis**
5. Confirmar a instalação
6. Reiniciar o browser

---

## Anexo B — Perfis de Acesso

| Grupo | Permissões |
|---|---|
| `tecnico` | Importar CSV GAL, aliquotagem, montar placa de extração e PCR |
| `especialista` | Tudo do técnico + enviar ao termociclador + importar e confirmar resultados |
| `supervisor` | Acesso total + Django Admin + edição manual de amostras |

Atribuir o grupo ao usuário via Django Admin: **Usuários → [usuário] → Grupos**.

---

*Documento gerado em 2026-04-06. Revisão 01 em 2026-04-07 — mDNS Avahi, deploy produção com Nginx. Revisão 02 em 2026-04-16 — backup automatizado, manutenção Docker, disaster recovery, plano de manutenção periódica. Revisão recomendada a cada nova versão major do sistema.*
