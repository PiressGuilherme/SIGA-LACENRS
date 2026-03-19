# SIGA-LACEN — Guia do Projeto

Sistema de Informação e Gerenciamento de Amostras do Laboratório de HPV (LACEN/CEVS).

---

## Estrutura do Projeto

```
SIGA-LACENRS/
├── backend/          ← API Django + Admin
├── frontend/         ← Interface React (componentes ricos)
├── docker/           ← Infraestrutura Docker (Nginx)
├── docker-compose.yml
├── docker-compose.override.yml
├── .env.example
├── Makefile
└── Planejamento.md
```

---

## Pasta por Pasta

### `backend/` — API Django (Python)

Todo o código do servidor roda aqui. É uma aplicação Django 5.1 com PostgreSQL.

```
backend/
├── config/                   ← Configurações globais do Django
│   ├── settings/
│   │   ├── base.py           ← Settings compartilhados (apps, middleware, JWT)
│   │   ├── development.py    ← DEBUG=True, debug-toolbar, CORS aberto
│   │   └── production.py     ← HTTPS, cookies seguros, sem debug
│   ├── urls.py               ← Roteamento principal: /admin/, /api/token/, /api/...
│   ├── wsgi.py               ← Entry point para Gunicorn (produção)
│   └── asgi.py               ← Entry point ASGI (futuro: WebSockets)
│
├── apps/                     ← Módulos do sistema (cada um é um app Django)
│   ├── usuarios/             ← Autenticação: login por e-mail, grupos de perfil
│   ├── amostras/             ← Cadastro e fluxo de amostras HPV
│   ├── placas/               ← Montagem de placas de 96 poços
│   └── resultados/           ← Resultados PCR por canal (CI, HPV16, HPV18, HPV AR)
│
├── fixtures/
│   └── grupos_iniciais.json  ← Grupos de perfil: extracao, pcr, supervisor
│
├── requirements/
│   ├── base.txt              ← Django, DRF, JWT, auditlog, psycopg2, etc.
│   ├── development.txt       ← + debug-toolbar
│   └── production.txt        ← = base (alias)
│
├── templates/                ← Templates HTML Django (telas sem React)
├── staticfiles/              ← Saída do collectstatic (gerado — não versionar)
├── mediafiles/               ← Uploads de usuários (gerado — não versionar)
│
├── manage.py                 ← CLI Django: migrate, shell, createsuperuser...
├── Dockerfile                ← Imagem de produção (Gunicorn)
├── Dockerfile.dev            ← Imagem de desenvolvimento (runserver + hot-reload)
└── entrypoint.sh             ← Startup: espera DB → migrate → loaddata → executa
```

#### Apps Django — o que vai em cada um

| App | Responsabilidade | Modelos |
|---|---|---|
| `usuarios` | Login por e-mail, grupos de acesso | `Usuario` |
| `amostras` | Registro, status e fluxo da amostra | `Amostra` |
| `placas` | Montagem da placa de 96 poços | `Placa`, `Poco` |
| `resultados` | Resultados PCR por canal e resultado final | `ResultadoPoco`, `ResultadoAmostra` |

Cada app tem: `models.py`, `admin.py`, `apps.py`, `serializers.py`, `views.py`, `urls.py`, `migrations/`.

---

### `frontend/` — Interface React (JavaScript/TypeScript)

Componentes ricos que não fazem sentido como template Django simples.
Integrado ao Django via **django-vite**: o Vite compila os bundles e os serve via Django staticfiles.

```
frontend/
├── src/
│   ├── components/
│   │   ├── plates/           ← Espelho de placa 8×12 (Fase 3)
│   │   └── ui/               ← Componentes reutilizáveis (botões, tabelas)
│   ├── pages/                ← Componentes de página (Dashboard, Revisão de resultados)
│   ├── services/
│   │   └── api.js            ← Cliente Axios centralizado para a API Django
│   ├── store/                ← Estado global (Zustand)
│   └── entries/              ← Entry points por módulo (plates.jsx, dashboard.jsx)
├── public/                   ← Assets estáticos (favicon, logos)
├── package.json              ← Dependências JS: React, Axios, Zustand, Vite
└── vite.config.js            ← Output → backend/static/vite/ para Django servir
```

**Quando o React é usado e quando não é:**
- Telas simples (login, listagens, Admin) → Django Templates
- Componentes interativos (espelho de placa, revisão de resultados, dashboard) → React

**Como o frontend "conversa" com o Django:**
- Em dev: Vite roda em `localhost:5173`, Django consome via `{% vite_asset %}`
- Em produção: `npm run build` gera bundles em `backend/static/vite/`, Django serve via Nginx

---

### `docker/` — Infraestrutura

```
docker/
└── nginx/
    ├── Dockerfile            ← Imagem Nginx baseada em nginx:alpine
    ├── nginx.conf            ← Proxy reverso: HTTPS para siga.lacen.local,
    │                            serve /static/ e /media/ diretamente
    └── certs/                ← Certificados mkcert (não versionados)
        └── siga.lacen.local.pem
        └── siga.lacen.local-key.pem
```

---

### Arquivos na raiz

| Arquivo | Para que serve |
|---|---|
| `docker-compose.yml` | Stack de produção: db + backend + nginx |
| `docker-compose.override.yml` | Overrides de dev: hot-reload, porta 8000 exposta, nginx desativado |
| `.env.example` | Template das variáveis de ambiente — copie para `.env` |
| `.env` | Variáveis locais reais — **nunca versionar** |
| `Makefile` | Atalhos: `make up-d`, `make migrate`, `make shell`, `make superuser` |
| `Planejamento.md` | Documento técnico do projeto: modelos, fases, decisões de design |
| `CLAUDE.md` | Este arquivo — guia para desenvolvedores e agentes |

---

## Como Rodar em Desenvolvimento

```bash
# 1. Copie e preencha as variáveis de ambiente
cp .env.example .env

# 2. Suba os containers
make up-d

# 3. (Primeira vez) Crie o superusuário
make superuser

# 4. Acesse
# Admin Django:  http://localhost:8000/admin/
# API:           http://localhost:8000/api/
```

## Perfis de Acesso

| Grupo | O que pode fazer |
|---|---|
| `extracao` | Importar CSV do GAL, montar placas, exportar PDF |
| `pcr` | Importar CSV do termociclador, revisar e confirmar resultados |
| `supervisor` | Tudo acima + edição manual de amostras + auditoria |

---

## Estado das Fases de Desenvolvimento

| Fase | Status | O que cobre |
|---|---|---|
| Fase 1 — Infraestrutura | ✅ Concluída | Django, Docker, PostgreSQL, Nginx, modelos |
| Fase 2 — Registro de amostras | ✅ Concluída | Import CSV GAL, tela preview, endpoint, fluxo de status refatorado |
| Fase 3 — Módulo de Recebimento | ✅ Concluída | Tela React scanner de alíquota, endpoint receber, status → Aliquotada |
| Fase 4 — Placas/Extração | ✅ Concluída | Espelho de placa React 8×12, scan da placa, cálculo de reagentes, confirmar extração |
| Fase 5 — Consulta de Amostras | 🔜 Próxima | Tela React de consulta/busca para o usuário final |
| Fase 6 — Resultados | 🔜 Aguarda critérios IBMP | Parser CFX Manager, classificação HPV, tela revisão |
| Fase 7 — Auditoria/Relatórios | 🔜 Planejado | Admin avançado, PDF/Excel |
| Fase 8 — Dashboard | 🔜 Planejado | Chart.js, alertas, contadores |

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Backend | Python 3.11, Django 5.1, DRF, simplejwt |
| Banco | PostgreSQL 15 |
| Frontend | React 18, Vite, Axios, Zustand |
| Infra | Docker, docker-compose, Nginx, mkcert |
| Auditoria | django-auditlog |
| Relatórios | ReportLab, openpyxl |
