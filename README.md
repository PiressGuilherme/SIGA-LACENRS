# SIGA-LACENRS

Sistema de Informação e Gerenciamento de Amostras do Laboratório de HPV — LACEN/CEVS-RS.

## Visão Geral

O SIGA-LACENRS é uma aplicação web para rastreamento completo do fluxo laboratorial de exames de HPV, desde a importação dos dados do sistema GAL (Gestão de Atividades Laboratoriais) até a liberação dos resultados. O sistema gerencia amostras, placas de extração, placas de PCR, resultados e integra-se ao GAL via WebService SOAP.

### Funcionalidades Principais

- **Importação de Amostras** — Upload de CSV exportado pelo GAL com preview e detecção automática de duplicatas
- **Aliquotagem** — Recebimento físico de amostras com leitura de código de barras e checkpoint de crachá
- **Extração** — Montagem de placas de extração de DNA (96 poços), cálculo de reagentes, exportação em PDF
- **PCR** — Montagem de placas PCR a partir de extrações ou do zero, submissão ao termociclador
- **Resultados** — Importação de CSV do CFX Manager (Bio-Rad), classificação automática por critérios IBMP, revisão e confirmação
- **Consulta** — Busca avançada de amostras e placas com filtros e espelho expansível
- **Integração GAL** — WebService SOAP para buscar exames e enviar resultados
- **Auditoria** — Histórico completo de alterações via django-auditlog

## Stack Tecnológica

| Camada         | Tecnologia                                     |
| -------------- | ---------------------------------------------- |
| Backend        | Python 3.11, Django 5.1, Django REST Framework |
| Banco de Dados | PostgreSQL 15                                  |
| Frontend       | React 18, Vite, TailwindCSS, Zustand           |
| Autenticação   | JWT (simplejwt) + Session Auth                 |
| Infraestrutura | Docker, docker-compose, Nginx, Gunicorn        |
| Auditoria      | django-auditlog                                |
| Relatórios     | ReportLab                                      |

## Como Rodar

### Pré-requisitos

- Docker e Docker Compose instalados
- Arquivo `.env` configurado (copie de `.env.example`)

### Desenvolvimento

```bash
# 1. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações

# 2. Subir os containers
make up-d

# 3. Criar superusuário (primeira vez)
make superuser

# 4. Acessar
# Admin Django:  http://localhost:8000/admin/
# API:           http://localhost:8000/api/
# Interface:     http://localhost:8000/
```

### Comandos Úteis

| Comando          | Descrição                        |
| ---------------- | -------------------------------- |
| `make up-d`      | Sobe os containers em background |
| `make migrate`   | Executa migrações do Django      |
| `make shell`     | Abre shell Django no container   |
| `make superuser` | Cria superusuário                |
| `make test`      | Executa testes automatizados     |
| `make logs`      | Exibe logs dos containers        |

## Estrutura do Projeto

```
SIGA-LACENRS/
├── backend/                    # API Django
│   ├── apps/
│   │   ├── amostras/           # Gestão de amostras, importação CSV
│   │   ├── placas/             # Placas de extração e PCR (96 poços)
│   │   ├── resultados/         # Resultados PCR, parser CFX Manager
│   │   ├── usuarios/           # Autenticação, permissões, perfis
│   │   └── gal_ws/             # Integração SOAP com GAL
│   ├── config/                 # Configurações Django (settings, urls)
│   ├── fixtures/               # Dados iniciais (grupos de permissão)
│   ├── requirements/           # Dependências Python
│   └── templates/              # Templates HTML Django
├── frontend/                   # Interface React
│   └── src/
│       ├── components/         # Componentes reutilizáveis
│       ├── design-system/      # Tokens e componentes de design
│       ├── entries/            # Entry points por módulo (Vite)
│       ├── pages/              # Componentes de página
│       ├── services/           # Cliente HTTP (Axios)
│       └── utils/              # Utilitários
├── docker/                     # Configurações Docker (Nginx)
├── docker-compose.yml          # Stack de produção
├── docker-compose.override.yml # Overrides de desenvolvimento
├── Makefile                    # Atalhos de comandos
└── .env.example                # Template de variáveis de ambiente
```

## Perfis de Acesso

| Perfil           | Permissões                                                                 |
| ---------------- | -------------------------------------------------------------------------- |
| **Técnico**      | Importar CSV, aliquotar, montar placas de extração e PCR                   |
| **Especialista** | Tudo do Técnico + submeter ao termociclador + revisar/confirmar resultados |
| **Supervisor**   | Acesso total (is_staff + is_superuser)                                     |

> **Checkpoint de crachá:** Operações de aliquotagem e confirmação de extração exigem scan do crachá físico. Administradores (`is_staff=True`) têm bypass automático.

## Fluxo de Status da Amostra

```
GAL CSV → Aguardando Triagem / Exame em Análise
              ↓
    [Aliquotagem] → Aliquotada
              ↓
    [Montar Placa Extração] → Extração
              ↓
    [Confirmar Extração] → Extraída
              ↓
    [Montar Placa PCR] → PCR
              ↓
    [Importar Resultado] → Resultado
              ↓
    [Liberar no GAL] → Resultado Liberado ✓

Exceções: Cancelada (terminal), Repetição Solicitada → retorna para PCR
```

## API Endpoints

### Autenticação

| Método | Endpoint                    | Descrição                  |
| ------ | --------------------------- | -------------------------- |
| POST   | `/api/auth/login/`          | Login com e-mail/senha     |
| POST   | `/api/auth/login-cracha/`   | Login com crachá           |
| POST   | `/api/auth/logout/`         | Logout                     |
| GET    | `/api/auth/validar-cracha/` | Validar crachá de operador |
| POST   | `/api/token/refresh/`       | Renovar token JWT          |

### Amostras

| Método | Endpoint                        | Descrição                            |
| ------ | ------------------------------- | ------------------------------------ |
| GET    | `/api/amostras/`                | Listar amostras (paginado)           |
| GET    | `/api/amostras/{id}/`           | Detalhe de amostra                   |
| GET    | `/api/amostras/{id}/historico/` | Histórico de auditoria               |
| GET    | `/api/amostras/filtros/`        | Filtros disponíveis (municípios, UF) |
| POST   | `/api/amostras/receber/`        | Confirmar aliquotagem                |
| POST   | `/api/amostras/preview-csv/`    | Preview de importação CSV            |
| POST   | `/api/amostras/importar-csv/`   | Importar CSV do GAL                  |

### Placas

| Método | Endpoint                          | Descrição                    |
| ------ | --------------------------------- | ---------------------------- |
| GET    | `/api/placas/`                    | Listar placas                |
| POST   | `/api/placas/`                    | Criar placa                  |
| GET    | `/api/placas/{id}/`               | Detalhe de placa             |
| GET    | `/api/placas/{id}/pdf/`           | Exportar PDF                 |
| GET    | `/api/placas/{id}/rascunho-pcr/`  | Rascunho PCR de extração     |
| POST   | `/api/placas/{id}/salvar-pocos/`  | Salvar poços da placa        |
| POST   | `/api/placas/{id}/submeter/`      | Enviar PCR ao termociclador  |
| POST   | `/api/placas/{id}/replicata/`     | Criar replicata de placa PCR |
| GET    | `/api/placas/buscar-amostra/`     | Buscar amostra elegível      |
| POST   | `/api/placas/confirmar-extracao/` | Confirmar extração           |

### Resultados

| Método | Endpoint                                    | Descrição                      |
| ------ | ------------------------------------------- | ------------------------------ |
| GET    | `/api/resultados/`                          | Listar resultados              |
| GET    | `/api/resultados/{id}/`                     | Detalhe com canais             |
| POST   | `/api/resultados/importar/`                 | Importar CSV do CFX Manager    |
| POST   | `/api/resultados/{id}/confirmar/`           | Confirmar resultado (imutável) |
| POST   | `/api/resultados/{id}/liberar/`             | Liberar resultado no GAL       |
| POST   | `/api/resultados/{id}/solicitar-repeticao/` | Solicitar repetição de PCR     |
| PATCH  | `/api/resultados/pocos/{id}/`               | Override manual de canal       |

### GAL WebService

| Método | Endpoint                      | Descrição               |
| ------ | ----------------------------- | ----------------------- |
| GET    | `/api/gal-ws/configuracao/`   | Ler configuração GAL    |
| POST   | `/api/gal-ws/configuracao/`   | Salvar configuração GAL |
| POST   | `/api/gal-ws/testar-conexao/` | Testar conexão com GAL  |
| POST   | `/api/gal-ws/buscar-exames/`  | Buscar exames pendentes |

## Modelos de Dados

### Amostra

Representa uma amostra de paciente para análise de HPV.

**Identificadores:** `cod_exame_gal` (único), `numero_gal`, `cod_amostra_gal`, `codigo_interno` (formato N/AA)

**Dados do paciente:** nome, nome_social, cns, cpf, municipio, uf, unidade_solicitante, material

**Datas:** data_coleta, data_recebimento

**Fluxo:** status (enum), observacoes, criado_por, recebido_por

### Placa

Placa de 96 poços (8×12) para extração ou PCR.

**Campos:** codigo (auto: HPVe{DDMMAA}-{N} / HPVp{DDMMAA}-{N}), tipo_placa (extracao/pcr), placa_origem (FK), protocolo, responsavel, extracao_confirmada_por, status_placa, observacoes

**Status por tipo:**

- Extração: `aberta` → `extracao_confirmada`
- PCR: `aberta` → `submetida` → `resultados_importados`

### Poco

Poço individual de uma placa.

**Campos:** placa (FK), amostra (FK, nullable), posicao (A01-H12), tipo_conteudo (amostra/cn/cp/vazio)

### ResultadoPoco

Resultado bruto de um canal de PCR por poço.

**Campos:** poco (FK), canal (CI/HPV16/HPV18/HPV_AR), cq, interpretacao, interpretacao_manual, justificativa_manual

### ResultadoAmostra

Resultado consolidado de uma amostra por run.

**Campos:** poco (OneToOne), ci_resultado, hpv16_resultado, hpv18_resultado, hpvar_resultado, resultado_final, confirmado_em, confirmado_por, imutavel

### Usuario

Usuário customizado com login por e-mail.

**Campos:** email (único), nome_completo, numero_cracha, is_active, is_staff, groups

### GalWsConfig

Configuração do GAL WebService (singleton).

**Campos:** usuario, senha, codigo_laboratorio, url_ws, verificar_ssl

## Testes

```bash
make test
```

36 testes automatizados cobrindo:

- State machine de transições de status
- Permissões por grupo em todos os ViewSets
- Validação de transições de status

## Roadmap

### Pendente

- [ ] **Fase 6 — Módulo de Resultados:** Implementar critérios IBMP Biomol (cutoffs de Cq) para classificação automática
- [ ] **Fase 6.5 — Integração e Robustez:** Testes E2E do fluxo completo, visualização de histórico de amostra
- [ ] **Fase 7 — Auditoria e Relatórios:** Configuração avançada do Admin, relatórios exportáveis (PDF/Excel)
- [ ] **Fase 8 — Dashboard:** Página inicial com Chart.js, contadores, gráficos e alertas
- [ ] **Integração GAL completa:** Implementar `marcarExamesEnviados` e `gravarResultados` no WebService
- [ ] **Responsividade:** Adaptar interface para tablets (uso em bancada)
- [ ] **Filtro por material:** Implementar filtro por material na consulta de amostras

### Melhorias Técnicas

- [ ] Adicionar testes de integração para endpoints de importação CSV
- [ ] Implementar rate limiting mais granular
- [ ] Adicionar logging estruturado para auditoria
- [ ] Otimizar queries com select_related/prefetch_related onde necessário
- [ ] Implementar CI/CD com GitHub Actions
