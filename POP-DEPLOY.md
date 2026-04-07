# POP — Procedimento Operacional Padrão
## Deploy e Atualização do SIGA-LACEN

**Documento:** POP-TI-001  
**Sistema:** SIGA-LACEN — Sistema de Informação e Gerenciamento de Amostras  
**Unidade:** LACEN-RS / CEVS  
**Elaborado por:** Equipe LSG 
**Revisão:** 00  

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

```bash
# Build das imagens (inclui compilação do frontend React)
docker compose build

# Subir todos os serviços em background
docker compose up -d
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
# Rebuild das imagens com o novo código
docker compose build

# Reiniciar os containers (zero-downtime não garantido — avisar usuários)
docker compose up -d
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

```bash
# Ver histórico de commits
git log --oneline -10

# Voltar para o commit anterior (substituir <HASH> pelo hash desejado)
git checkout <HASH>

# Reconstruir com a versão anterior
docker compose build
docker compose up -d
```

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
# Acessar https://siga.lacen.local/admin/ → Usuários → Adicionar
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

### 6.3 Backup do banco de dados

```bash
# Criar dump
docker compose exec db pg_dump -U siga_user siga_lacen > backup_$(date +%Y%m%d_%H%M).sql

# Restaurar dump (em caso de necessidade)
docker compose exec -T db psql -U siga_user siga_lacen < backup_20260101_0800.sql
```

> Recomendado: agendar backup diário via cron no servidor host.

```bash
# Exemplo de cron diário às 2h da manhã
# Editar com: crontab -e
0 2 * * * cd /opt/siga-lacen && docker compose exec -T db pg_dump -U siga_user siga_lacen > /backup/siga_$(date +\%Y\%m\%d).sql
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

```bash
docker compose restart backend    # reinicia só o backend
docker compose restart nginx      # reinicia só o Nginx
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

*Documento gerado em 2026-04-06. Revisão 01 em 2026-04-07 — mDNS Avahi, deploy produção com Nginx. Revisão recomendada a cada nova versão major do sistema.*
