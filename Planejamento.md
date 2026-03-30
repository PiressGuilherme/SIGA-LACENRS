# SIGA LACEN
## Sistema de Informação e Gerenciamento de Amostras
**Laboratório de HPV LACEN/CEVS** | **Plano de Desenvolvimento (Atualizado)**

---

### Resumo Executivo
Este documento descreve o plano completo para o desenvolvimento do SIGA-LACEN (Sistema de Informação e Gerenciamento de Amostras) para o Laboratório de HPV do LACEN/CEVS. O sistema adota arquitetura web-first conteneirizada: servidor Linux rodando Docker + docker-compose com Django 5 e PostgreSQL, servindo tanto a API REST quanto a interface web, acessível por qualquer navegador na rede local (LAN) sem instalação de software nos clientes Windows. O Django Admin cobre nativamente o módulo de consulta e auditoria. Interfaces mais ricas (espelho de placa, importação de resultados) são entregues como componentes React integrados ao ecossistema via `django-vite`. O desenvolvimento está organizado em fases cobrindo: infraestrutura, registro de amostras, montagem de placas de extração, módulo de PCR, importação de resultados, consulta/auditoria e dashboard.

---

### Stack Tecnológica

| Camada | Tecnologia | Justificativa |
| :--- | :--- | :--- |
| Infraestrutura | Docker + docker-compose | Padronização de ambiente, facilidade de deploy e manutenibilidade |
| Interface web | Django Templates + React (django-vite) | Web-first: acesso pelo browser. Vite garante build moderno do React |
| Backend (Linux) | Python + Django 5 + DRF | Framework completo, Admin nativo, ORM maduro |
| Admin web | Django Admin | Consulta, edição e auditoria de amostras sem custo dev |
| API REST | Django REST Framework | Serializers, ViewSets e autenticação integrados |
| Banco de dados | PostgreSQL 15+ | Robusto, ACID, suporte nativo no Django ORM |
| Autenticação | simplejwt (DRF) | Tokens stateless com refresh, perfis via Groups |
| Servidor web | Gunicorn + Nginx | Gunicorn processa Django; Nginx termina SSL e serve estáticos |
| HTTPS local | mkcert | Certificado CA próprio para LAN, instalado nos browsers |
| Migrações | Django Migrations | manage.py makemigrations/migrate, versionado e simples |
| Auditoria | django-auditlog | Log automático de alterações via signals, sem código extra |
| Resultados PCR | openpyxl + csv (Python) | Parser de CSV do CFX Manager (Bio-Rad) configurado para o termociclador do laboratório |
| Relatórios | ReportLab + openpyxl | Geração de PDF e Excel para exportação de laudos |

---

### Modelo de Dados

#### Amostra
Mapeamento direto do CSV exportado pelo GAL (separador `;`, encoding Latin-1).

| Campo | Coluna CSV | Tipo | Descrição |
| :--- | :--- | :--- | :--- |
| `cod_exame_gal` | `Cód. Exame` | CharField (único) | Identificador único do exame no GAL |
| `numero_gal` | `Requisição` | CharField | Número da requisição do paciente no GAL — 1 por paciente |
| `cod_amostra_gal` | `Cód. Amostra` | CharField | Código da amostra física no GAL |
| `codigo_interno` | `Num.Interno` | CharField (único, nullable) | Código LACEN no formato `N/AA` (ex: `1/26`). Importado do CSV quando disponível; preenchido manualmente quando ausente |
| `nome_paciente` | `Paciente` | CharField | Nome completo do paciente |
| `nome_social` | `Nome Social` | CharField | Nome social (opcional) |
| `cns` | `CNS` | CharField | Cartão Nacional de Saúde |
| `cpf` | `CPF` | CharField | CPF do paciente |
| `municipio` | `Mun. Residência` | CharField | Município de residência |
| `uf` | `UF Residência` | CharField | Unidade Federativa |
| `unidade_solicitante` | `Requisitante` | CharField | UBS / unidade que solicitou o exame |
| `municipio_solicitante` | `Mun. Requisitante` | CharField | Município da unidade solicitante |
| `material` | `Material` | CharField | Tipo de material (ex: Secreção endocervical, Swab) |
| `data_coleta` | `Dt. Cadastro` | DateTimeField | Data de cadastro/coleta no GAL |
| `data_recebimento` | `Dt. Recebimento` | DateTimeField | Data de recebimento no LACEN (nullable — ausente em amostras ainda não recebidas) |
| `status` | — | CharField (enum) | Fluxo interno do LACEN — ver Fluxo de Status |
| `criado_em` | — | DateTimeField | Auto |
| `atualizado_em` | — | DateTimeField | Auto |

> **Ciclo de vida da Amostra:**
> - Uma **Requisição GAL** corresponde a **um paciente**. No LACEN, cada importação cria uma **Amostra mãe**.
> - A Amostra mãe é **aliquotada uma única vez** → status: `Aliquotada`.
> - Em caso de **reteste**, a **mesma alíquota** é reutilizada (não há nova aliquotagem).
> - Em um novo ciclo anual, o paciente aparece com uma **nova Requisição GAL** → nova Amostra mãe → nova alíquota.
>
> **Dados nominativos:** O sistema armazena nome, CPF e CNS para uso interno autorizado. O acesso é controlado por perfil de usuário.

#### Placa
Representa uma placa de 96 poços (8×12). O mesmo modelo é usado para placas de extração e de PCR, diferenciados pelo campo `tipo_placa`.

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `codigo` | CharField (único) | Gerado automaticamente no formato `HPV{DDMMAA}-{N}` (ex: `HPV240326-1`). Sequencial por dia, compartilhado entre extração e PCR. |
| `tipo_placa` | CharField (enum) | `extracao` — placa de extração de DNA (congelada, rastreada); `pcr` — placa que vai ao termociclador |
| `placa_origem` | ForeignKey (Placa, nullable) | Para placas PCR: referência à placa de extração usada como base. Null quando criada do zero. |
| `protocolo` | CharField | Identificador do protocolo utilizado |
| `responsavel` | ForeignKey (User) | Operador que montou a placa |
| `extracao_confirmada_por` | ForeignKey (User, nullable) | Operador que confirmou a extração via scan de crachá |
| `status_placa` | CharField (enum) | Ver tabela de status abaixo |
| `observacoes` | TextField | Campo livre |
| `data_criacao` | DateTimeField | Auto |
| `atualizado_em` | DateTimeField | Auto |

**Status da Placa por tipo:**

| Status | Tipo | Descrição |
| :--- | :--- | :--- |
| `aberta` | extração e PCR | Em montagem/edição |
| `extracao_confirmada` | **só extração** | Extração de DNA concluída; scan do código da placa confirmou |
| `submetida` | **só PCR** | Placa enviada ao termociclador; aguardando CSV de resultados |
| `resultados_importados` | **só PCR** | CSV do CFX Manager importado; resultados disponíveis |

#### Poco (intermediário Placa ↔ Amostra)
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `placa` | ForeignKey (Placa) | |
| `amostra` | ForeignKey (Amostra, nullable) | Null para poços de controle |
| `posicao` | CharField | Formato `A01`–`H12` |
| `tipo_conteudo` | CharField (enum) | Amostra / Controle Negativo / Controle Positivo / Vazio |

#### ResultadoPoco (um registro por canal por poço)
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `poco` | ForeignKey (Poco) | |
| `canal` | CharField (enum) | CI / HPV16 / HPV18 / HPV_AR |
| `cq` | FloatField (nullable) | Valor de Cq; None = não amplificou |
| `interpretacao` | CharField (enum) | Positivo / Negativo / Inválido — calculado automaticamente pelos critérios IBMP |
| `interpretacao_manual` | CharField (nullable) | Override pelo operador na revisão |
| `justificativa_manual` | TextField (nullable) | Obrigatório quando `interpretacao_manual` é preenchido |

#### ResultadoAmostra (consolidado por run)
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `poco` | ForeignKey (Poco) | Identifica o run específico da amostra |
| `ci_resultado` | CharField | Positivo / Negativo / Inválido |
| `hpv16_resultado` | CharField | Positivo / Negativo / Inválido |
| `hpv18_resultado` | CharField | Positivo / Negativo / Inválido |
| `hpvar_resultado` | CharField | Positivo / Negativo / Inválido |
| `resultado_final` | CharField (enum) | HPV Detectado / HPV Não Detectado / Inválido |
| `confirmado_em` | DateTimeField (nullable) | Timestamp da confirmação definitiva |
| `confirmado_por` | ForeignKey (User, nullable) | |
| `imutavel` | BooleanField | True após confirmação — resultado não pode ser alterado |

---

### Módulos do Sistema

#### Registro de Amostras (Importação GAL)
* Upload de arquivo CSV do GAL pelo browser (página web Django).
* **Tela de pré-visualização (Preview):** Validação estrita onde o sistema analisa o arquivo e exibe um resumo (amostras válidas, duplicadas ou com erro) para confirmação humana antes da inserção no banco de dados.
* Status inicial da amostra importada é derivado automaticamente da coluna `Status Exame` do CSV GAL:
  * Valores não mapeados ou desconhecidos → `Aguardando Triagem` (fallback seguro).
  * Ver `GAL_STATUS_MAP` em `utils.py` para o mapeamento; ajustar quando os valores reais do GAL forem confirmados.
* Listagem e revisão via Django Admin.

#### Módulo de Aliquotagem
* Tela web dedicada ao recebimento físico e aliquotagem das amostras (`/amostras/aliquotagem/`).
* **Checkpoint de crachá:** operador identifica-se por scan do crachá antes de iniciar; nome exibido no topo; troca de operador a qualquer momento sem perder o trabalho em curso.
* Operador escaneia o código de barras da alíquota → sistema localiza a amostra pelo `cod_amostra_gal`, `codigo_interno` ou `cod_exame_gal`.
* Confirmação da alíquota pelo scanner → status da amostra muda para `Aliquotada`.
* Múltiplas amostras podem ser confirmadas em sequência em uma mesma sessão.
* Registra data/hora e operador responsável (`recebido_por` = usuário do crachá escaneado).

#### Módulo de Extração (`/placas/extracao/`)
Duas abas: **Montar Placa** e **Consultar Placas**.

**Montar Placa:**
* Espelho de placa 8×12 editável (componente React).
* Operador escaneia ou digita `codigo_interno` de cada amostra; elegíveis: status `Aliquotada`.
* Suporte a controles CN e CP em posições configuráveis.
* Ao salvar: amostras → `Extração`; placa recebe código `HPV{DDMMAA}-{N}`.
* Cálculo automático de volumes de reagentes (Tampão de Lise, Oligomix, Enzima).
* Exportação em PDF (formulário FR-HPV-001).
* Placa de extração é **salva no banco e rastreada** — o DNA extraído é congelado e pode ser reutilizado.

**Consultar Placas:**
* Listagem de todas as placas de extração com filtro por status; linha expansível exibe espelho 8×12 e lista de amostras por posição.
* Campo de scan para **Confirmar Extração** com checkpoint de crachá: operador identifica-se por crachá, depois escaneia o código da placa → todas as amostras → `Extraída`; placa → `Extração confirmada`; `extracao_confirmada_por` registra o operador.

#### Módulo de PCR (`/placas/pcr/`)
Duas abas: **Montar Placa PCR** e **Consultar Placas PCR**.

**Montar Placa PCR:**
* Pode ser criada de três formas:
  1. **A partir de uma extração:** seleciona uma placa com status `Extração confirmada` como base; os poços são carregados como rascunho (amostras não elegíveis — não extraídas — são omitidas automaticamente).
  2. **Do zero:** placa vazia para montar livremente.
  3. **Abrir existente:** carrega uma placa PCR já salva.
* Amostras elegíveis: status `Extraída` ou superior (`Resultado`, `Resultado Liberado`, `Repetição Solicitada`).
* Amostras com resultado já registrado exibem flag visual amarela e exigem confirmação explícita antes de serem adicionadas (indicativo de repetição/reteste).
* Ao salvar: placa PCR criada com `tipo_placa=pcr`; status das amostras **não é alterado** (já estão `Extraída`).
* Cálculo de reagentes (Master Mix, Primer Mix) e exportação em PDF.
* Botão **Enviar ao Termociclador** (visível apenas para placas salvas e abertas) → placa → `Submetida`.

**Consultar Placas PCR:**
* Listagem de todas as placas PCR com coluna "Extração base".
* Botão **Enviar ao Termociclador** por linha (para placas com status `Aberta`).
* Botão PDF disponível para todas as placas com amostras.

#### Módulo de Resultados (`/resultados/revisar/`)
* Upload do CSV exportado do CFX Manager (Bio-Rad).
* **Cruzamento por posição de poço:** parser identifica amostras pelo poço (`A01` → `Poco.posicao`), não pelo código interno.
* Interpretação automática por critérios IBMP (cutoffs de Cq a definir).
* Lógica de resultado consolidado: CI inválido → Inválida; qualquer HPV+ → HPV Detectado; todos HPV− → HPV Não Detectado.
* Tela de revisão com edição individual e justificativa obrigatória.
* Alertas para controles falhos (CN amplificou / CP não amplificou).
* Ao confirmar: `ResultadoAmostra.imutavel = True`; amostras → `Resultado`.
* Fluxo de repetição: amostras marcadas para repetição → `Aliquotada` para nova placa PCR.

#### Consulta de Amostras
* Busca avançada no Django Admin e tela React dedicada (`/amostras/consulta/`).
* Edição manual com campo de justificativa obrigatório.
* Histórico completo de alterações via django-auditlog.

#### Dashboard
* Gráficos e contadores via aggregations do ORM + Chart.js.
* Contadores de amostras por status, gráfico de resultados por genótipo, últimas placas processadas.
* Alerta de amostras em `Repetição Solicitada` aguardando reprocessamento.

---

### Fluxo de Status da Amostra

```
[GAL CSV] ──► Aguardando Triagem
                    │
                    ▼
             Exame em Análise     (status refletido do GAL)
                    │
          [Módulo de Aliquotagem]
                    │ scanner confirma alíquota
                    ▼
               Aliquotada
                    │
          [Módulo de Extração — Montar Placa]
                    │ placa de extração salva
                    ▼
                Extração
                    │
          [Módulo de Extração — Confirmar Extração]
                    │ scan do código da placa
                    ▼
                Extraída  ◄─────────────────────────────┐
                    │                                    │
          [Módulo PCR — Montar + Enviar]                 │
                    │ placa PCR enviada ao termociclador  │
                    │ (amostras permanecem Extraída)      │
                    │                                    │
          [Módulo de Resultados — Import CSV]            │
                    │                                    │
                    ▼                                    │
               Resultado                                 │
                    │                                    │
          [Publicação no GAL]        [Repetição] ────────┘
                    │
                    ▼
          Resultado Liberado ✓
```

| # | Status | Gatilho |
|---|---|---|
| 1 | **Aguardando Triagem** | Importação do CSV GAL (status padrão / fallback) |
| 2 | **Exame em Análise** | Importação do CSV GAL (quando Status Exame GAL indica análise) |
| 3 | **Aliquotada** | Scanner confirma alíquota no Módulo de Aliquotagem |
| 4 | **Extração** | Amostra adicionada à placa de extração; placa salva |
| 5 | **Extraída** | Código da placa de extração escaneado (Confirmar Extração) |
| 6 | **Resultado** | CSV do CFX Manager importado e interpretado (Módulo de Resultados) |
| 7 | **Resultado Liberado** | Resultado publicado na tabela do GAL |

**Status de Exceção:**
* **Cancelada** — Amostra descartada com justificativa; editável apenas por supervisor
* **Repetição Solicitada** — Resultado inválido; amostra retorna ao status `Aliquotada` para nova placa PCR

**Rastreabilidade de Retestes:**
Uma amostra pode aparecer em múltiplas placas PCR ao longo do tempo (uma por tentativa). O resultado ativo é sempre o último `ResultadoAmostra` com `imutavel=True`. O histórico completo de todas as tentativas é acessível via `Amostra → Pocos → ResultadoPoco`.

---

### Perfis de Acesso

| Perfil | Permissões |
| :--- | :--- |
| `extracao` | Importar CSV GAL; aliquotagem (scan de alíquota com crachá); montar e editar placas de extração; confirmar extração (scan de crachá + código de placa); exportar PDF da placa |
| `pcr` | Montar placa PCR; enviar ao termociclador; importar CSV do termociclador; revisar e confirmar resultados |
| `supervisor` | Todas as operações acima + editar amostras manualmente + cancelar amostras + acessar auditoria; bypass de crachá (ação executada com identidade do próprio supervisor) |

> Todos os perfis autenticados têm acesso à consulta de amostras e de placas.

> **Checkpoint de crachá:** em operações de aliquotagem e confirmação de extração, o sistema exige o código do crachá físico do operador. O usuário logado na sessão web pode ser diferente do operador na bancada. Superusers não precisam escanear o crachá.

> **`numero_cracha`** é um campo do model `Usuario`. O endpoint `GET /api/auth/validar-cracha/?codigo=` retorna nome e perfil do operador para exibição no frontend.

---

### Sistema de Autenticação em Duas Camadas

O SIGA-LACEN implementa um sistema de autenticação de duas camadas para garantir rastreabilidade completa das ações realizadas no laboratório:

#### Camada 1: Login Web (Autenticação de Sessão)
* **Objetivo:** Controlar o acesso ao sistema
* **Método:** Login com e-mail/senha ou crachá diretamente na tela de login
* **Resultado:** Geração de token JWT (`access_token` e `refresh_token`)
* **Responsável pelo log:** `request.user` do Django (usuário logado na sessão)
* **Quando é usado:** Para acessar o sistema, navegar entre módulos e operações de consulta

#### Camada 2: Scan de Crachá (Autenticação de Ação)
* **Objetivo:** Identificar quem está executando uma ação específica na bancada
* **Método:** Modal bloqueante que exige escanear o crachá antes de iniciar qualquer operação
* **Resultado:** Operador identificado por `numero_cracha` é enviado ao backend em cada requisição
* **Responsável pelo log:** Campos de rastreamento (`confirmado_por`, `recebido_por`, `extracao_confirmada_por`)
* **Quando é usado:** Em todas as operações críticas listadas abaixo

#### Operações que exigem autenticação por crachá:

| Módulo | Operação | Campo de Rastreamento |
|--------|---------|----------------------|
| Aliquotagem | Confirmar alíquota | `recebido_por` na `Amostra` |
| Extração | Salvar placa | `responsavel` na `Placa` |
| Extração | Confirmar extração | `extracao_confirmada_por` na `Placa` |
| PCR | Salvar placa PCR | `responsavel` na `Placa` |
| PCR | Enviar ao termociclador | `submetido_por` no registro |
| Resultados | Importar CSV | `operador` no `auditlog` |
| Resultados | Confirmar resultado | `confirmado_por` no `ResultadoAmostra` |
| Resultados | Liberar resultado | `liberado_por` no registro |
| Resultados | Solicitar repetição | `operador` no `auditlog` |

#### Comportamento do Sistema

1. **Modal Bloqueante:** Ao acessar qualquer módulo operacional (Aliquotagem, Extração, PCR, Resultados), um modal é exibido bloqueando a página até que o operador escaneie o crachá.

2. **Exceção:** Superusers e usuários com `is_staff=True` podem fazer bypass do crachá (ação é registrada como o próprio usuário logado).

3. **Troca de Operador:** O operador pode trocar o crachá a qualquer momento clicando em "Trocar operador". A partir desse ponto, todas as ações são registradas com o novo operador.

4. **Persistência na Sessão:** O operador identificado permanece ativo durante toda a sessão do módulo.

#### Implementação Técnica

**Frontend:**
* `CrachaModal.jsx` — componente React de modal bloqueante
* Enviado `numero_cracha` em todas as requisições POST/PATCH que alteram dados

**Backend:**
* Função `_resolver_operador()` em cada ViewSet extrai o `numero_cracha` do request
* `auditlog.context.set_actor(operador)` configura o ator correto no auditlog
* Fallback para `request.user` quando crachá não é fornecido

**Banco de Dados:**
* Campo `numero_cracha` no model `Usuario`
* Campos de rastreamento (`confirmado_por`, `recebido_por`, etc.) são ForeignKey para `Usuario`

---

### Fases de Desenvolvimento

#### Fase 1 - Infraestrutura e Contêineres ✅ Concluída
* ✅ Estrutura Docker (Dockerfile e docker-compose.yml) para Python, Django 5, PostgreSQL e Nginx.
* ✅ Projeto Django com apps base: `amostras`, `placas`, `resultados`, `usuarios`.
* ✅ Autenticação JWT com djangorestframework-simplejwt.
* ✅ Django Admin com perfis via Groups (`extracao`, `pcr`, `supervisor`).
* ✅ Nginx com HTTPS (mkcert) na LAN dentro do ambiente Docker.

#### Fase 2 - Módulo de Registro Inteligente ✅ Concluída
* ✅ Model `Amostra` atualizado com todos os campos do CSV GAL (nome, CPF, CNS, datas como DateTimeField, etc.)
* ✅ `utils.py` com parser do CSV/ZIP GAL (encoding Latin-1, separador `;`, mapeamento de colunas, parse de datas). `parse_gal_file()` aceita `.csv` ou `.zip` com múltiplos CSVs.
* ✅ Endpoints DRF implementados:
  * `POST /api/amostras/preview-csv/` — parse sem salvar; retorna preview com `_status_importacao` (novo/atualizável/duplicado) por linha
  * `POST /api/amostras/importar-csv/` — importação real; ignora duplicatas por `cod_exame_gal`; retorna resumo
* ✅ Django Admin configurado: busca por nome/CPF/CNS/GAL; filtros por status/UF/município; ordenação numérica de `codigo_interno` (N/AA); status editável inline na listagem
* ✅ `StatusAmostra` refatorado para refletir o fluxo real GAL → LACEN (Aguardando Triagem, Exame em Análise, + statuses internos)
* ✅ `GAL_STATUS_MAP` em `utils.py` mapeia `Status Exame` do GAL ao status interno na importação
* ✅ Valores de `Status Exame` do GAL confirmados: Aguardando Triagem, Exame em Análise, Resultado Liberado, Exame Cancelado
* ✅ Tela React de importação (`ImportCSV.jsx`) — 3 etapas: upload → preview (tabela ordenável por qualquer coluna, incluindo `codigo_interno` com lógica N/AA) → resultado

#### Fase 3 - Módulo de Aliquotagem ✅ Concluída
* ✅ Tela React de aliquotagem (`Aliquotagem.jsx` via django-vite) em `/amostras/aliquotagem/`
* ✅ Operador escaneia código de barras → sistema localiza por `codigo_interno`, `cod_amostra_gal` ou `cod_exame_gal`
* ✅ Confirmação via scanner → status muda para `Aliquotada`
* ✅ Suporte a leitura em sequência (múltiplas alíquotas por sessão com contador)
* ✅ Feedback em tempo real: sucesso (verde), já aliquotada (amarelo), erro (vermelho)
* ✅ Endpoint: `POST /api/amostras/receber/`
* ✅ Campo `recebido_por` registra o operador do crachá escaneado
* ✅ **Checkpoint de crachá:** `CrachaInput.jsx` exige identificação antes de liberar scan de alíquota; nome do operador exibido; troca de operador sem perder sessão
* ✅ Permissão enforçada: apenas perfil `extracao` ou `supervisor` (+ superuser) pode usar o endpoint
* ✅ **Rebranding:** módulo era chamado "Recebimento"; renomeado para "Aliquotagem" em toda a UI/navbar/URLs

#### Fase 4 - Módulo de Extração ✅ Concluída
* ✅ Componente React de placa 8×12 editável (`MontarPlaca.jsx`):
  * ✅ Leitura de `codigo_interno` por scanner ou digitação (também aceita `cod_amostra_gal` e `cod_exame_gal`)
  * ✅ Marcação de poços como CN, CP ou Vazio
  * ✅ Cálculo automático de volumes de reagentes (Tampão de Lise, Oligomix, Enzima)
  * ✅ Detecção de duplicatas (mesma amostra na mesma placa)
  * ✅ Criação lazy da placa — placa só é criada no banco ao salvar
  * ✅ Excluir placa com reversão automática das amostras para `Aliquotada`
  * ✅ Exportação em PDF (formulário FR-HPV-001)
* ✅ Aba **Consultar Placas** de extração com scan para Confirmar Extração:
  * ✅ Scan do código da placa → amostras → `Extraída`; placa → `Extração confirmada`
  * ✅ Exibe lista de amostras extraídas com feedback
  * ✅ Filtro por status (`Aberta`, `Extração confirmada`)
* ✅ Código da placa gerado automaticamente no formato `HPV{DDMMAA}-{N}` (ex: `HPV240326-1`)
* ✅ Navegação: item **Extração** na navbar (`/placas/extracao/`)
* ✅ `GET /api/placas/{id}/pdf/` — gera PDF FR-HPV-001 (ReportLab): cabeçalho, grid 8×12 colorido, tabela de reagentes
* ✅ `GET /api/placas/buscar-amostra/?codigo=` — busca por `codigo_interno`, `cod_amostra_gal`, `cod_exame_gal`; elegível: status `Aliquotada`
* ✅ `POST /api/placas/confirmar-extracao/` — scan do código; atualiza amostras e status da placa
* ✅ `perform_destroy` reverte amostras vinculadas para `Aliquotada`

#### Fase 4B - Módulo de PCR ✅ Concluída
* ✅ Componente React `MontarPCR.jsx`:
  * ✅ Três modos de início: carregar de extração como rascunho / nova do zero / abrir placa PCR existente
  * ✅ Amostras elegíveis: `Extraída`, `Resultado`, `Resultado Liberado`, `Repetição Solicitada`
  * ✅ Flag visual amarela para amostras com resultado — exige confirmação explícita (indicativo de reteste)
  * ✅ Cálculo de reagentes (Master Mix, Primer Mix)
  * ✅ Exportação em PDF e botão **Enviar ao Termociclador**
  * ✅ `placa_origem` preservado — rastreia qual extração originou a placa PCR
* ✅ Aba **Consultar Placas PCR** com botão por linha "Enviar ao Termociclador" (placas `Aberta`)
* ✅ Endpoint `GET /api/placas/{id}/rascunho-pcr/` — retorna poços da extração formatados como rascunho; amostras não elegíveis são omitidas
* ✅ Endpoint `GET /api/placas/buscar-amostra/?codigo=&modulo=pcr` — retorna amostras `Extraída+`; inclui flag `tem_resultado`
* ✅ Endpoint `POST /api/placas/{id}/submeter/` — só para placas PCR; placa → `Submetida`
* ✅ Navegação: item **PCR** na navbar (`/placas/pcr/`)
* ✅ Modelo `Placa` atualizado: campos `tipo_placa` e `placa_origem`; migration 0005 aplicada

#### Fase 5 - Consulta de Amostras ✅ Concluída
* ✅ Tela React acessível a todos os perfis autenticados (`/amostras/consulta/`)
* ✅ Tabela paginada com todas as amostras do sistema (50 por página)
* ✅ Busca textual por: nome do paciente, CPF, CNS, código interno, número GAL, cód. exame
* ✅ Filtros por: status, município (dropdowns populados via `/api/amostras/filtros/`)
* ✅ Ordenação por colunas clicáveis
* ✅ Badge colorido de status
* ✅ Endpoint DRF com paginação, filtros e busca: `GET /api/amostras/?search=&status=&municipio=&page=`
* ⚠️ **Pendente:** Filtro por material não implementado no backend nem no frontend

#### Fase 5.5 - Consolidação e Qualidade ✅ Concluída
> Passos intermediários essenciais para um sistema de laboratório clínico.

**Testes automatizados — 36 testes, 100% passando:**
* ✅ `apps.amostras.tests`: state machine (`TestTransicoesValidas`, `TestValidarTransicao`), permissões da API (`TestAmostraPermissoes`) — 15 testes
* ✅ `apps.placas.tests`: permissões da API (`TestPlacaPermissoes`) — 9 testes
* ✅ `apps.resultados.tests`: permissões da API (`TestResultadoPermissoes`) — 12 testes

**Permissões por grupo — `apps/usuarios/permissions.py`:**
* ✅ `IsExtracaoOuSupervisor` — aliquotagem e confirmar extração
* ✅ `IsPCROuSupervisor` — montar PCR, enviar termociclador, importar/confirmar resultados
* ✅ `IsSupervisor` — criar/editar/excluir amostras diretamente
* ✅ `IsLaboratorio` — qualquer perfil de laboratório pode criar/editar placas e salvar poços
* ✅ Aplicadas via `get_permissions()` em `AmostraViewSet`, `PlacaViewSet`, `ResultadoPocoViewSet`, `ResultadoAmostraViewSet`

**Auditoria — django-auditlog:**
* ✅ Ativo em 5 models: `Amostra`, `Placa`, `Poco`, `ResultadoPoco`, `ResultadoAmostra`

**State machine de status da amostra:**
* ✅ `TRANSICOES_VALIDAS` — dicionário cobrindo todos os 9 statuses
* ✅ `validar_transicao(status_atual, novo_status)` — levanta `ValidationError` para transições inválidas
* ✅ `CANCELADA` é terminal (sem saída)

**Checkpoint de crachá (badge authentication):**
* ✅ Campo `numero_cracha` adicionado ao model `Usuario`
* ✅ Endpoint `GET /api/auth/validar-cracha/?codigo=` — retorna `id`, `nome_completo`, `perfil`
* ✅ `CrachaInput.jsx` — componente reutilizável com auto-foco, validação, troca de operador
* ✅ Campo `extracao_confirmada_por` adicionado ao model `Placa` (migration 0007)
* ✅ Endpoints `receber` e `confirmar-extracao` exigem `numero_cracha`; superusers fazem bypass

**Consulta de Amostras — melhorias:**
* ✅ Detecção automática de formato do CSV GAL (Formato A e Formato B)
* ✅ Detecção de duplicatas cross-format
* ✅ Linha expansível na tabela de consulta exibe detalhes da amostra
* ✅ Aba "Placas" na tela de consulta — espelho 8×12 expansível por placa, Confirmar Extração com crachá

#### Fase 6 - Módulo de Resultados e Repetição (2-3 semanas)
> **Pré-requisito:** Obter critérios IBMP Biomol (cutoffs de Cq por canal) antes de implementar a lógica de classificação.
> O CSV do CFX Manager é importado contra uma **placa PCR** (não contra placa de extração).

* Página web de upload do CSV do CFX Manager (seleção da placa PCR correspondente).
* Parser formatado para o modelo do CFX Manager (Bio-Rad):
  * Lê metadados do cabeçalho
  * Agrupa linhas por poço
  * Extrai Cq por canal (CI, HPV16, HPV18, HPV_AR)
  * Cruza por `posicao` do poço com a placa PCR salva no banco
* Implementar classificação automática por critérios IBMP Biomol.
* Calcular `resultado_final` consolidado por amostra.
* Ao importar com sucesso: status das amostras da placa PCR → `Resultado`; placa → `Resultados importados`.
* Tela de revisão de resultados com edição individual e justificativa obrigatória.
* Alertas para controles falhos (CN amplificou / CP não amplificou).
* Gestão de Repetições — amostras para repetição voltam para `Aliquotada` para nova placa PCR.
* Gravação imutável de resultados confirmados (`imutavel=True`).
* Endpoint para marcar resultado como liberado no GAL → status `Resultado Liberado`.

#### Fase 6.5 - Integração e Robustez (1-2 semanas)
* Testes E2E do fluxo completo: Importar CSV → Receber → Extração → Confirmar Extração → PCR → Enviar Termociclador → Importar Resultado → Confirmar → Liberar
* Fluxo de repetição completo na UI: botão "Solicitar Repetição" na revisão → amostra → `Aliquotada` → nova placa PCR
* Visualização do histórico de uma amostra: timeline com todas as placas/poços/resultados anteriores
* Endpoint `GET /api/amostras/{id}/historico/` — retorna timeline completa

#### Fase 7 - Auditoria e Relatórios (2 semanas)
* Configuração avançada do Django Admin (filtros e buscas por status, data, município, resultado).
* Tela de auditoria para supervisor: histórico de alterações por amostra via django-auditlog.
* Relatórios exportáveis:
  * PDF de resultados por placa PCR (laudo consolidado)
  * Excel de resultados por período (exportação para vigilância epidemiológica)
* Indicadores para supervisor: amostras pendentes por status, placas abertas, resultados por confirmar

#### Fase 8 - Dashboard e Polish (2 semanas)
* Página inicial com Chart.js (dashboard pós-login).
* Contadores de amostras por status atual (cards com ícones).
* Gráfico de resultados por genótipo e filtro de período.
* Tabela das últimas placas processadas (extração e PCR) com link direto para detalhes.
* Alertas automáticos de amostras pendentes (`Repetição Solicitada`, amostras paradas há mais de N dias).
* Responsividade para tablets (recebimento e montagem de placa usados no bancada do laboratório).

---

### Arquitetura de Comunicação

| Operação | Método | Endpoint | Perfil requerido |
| :--- | :--- | :--- | :--- |
| Login / obter token | POST | /api/token/ | todos |
| Renovar token | POST | /api/token/refresh/ | todos |
| Validar crachá do operador | GET | /api/auth/validar-cracha/?codigo= | todos autenticados |
| Preview CSV de amostras | POST | /api/amostras/preview-csv/ | extracao / supervisor |
| Importar CSV de amostras | POST | /api/amostras/importar-csv/ | extracao / supervisor |
| Listar amostras | GET | /api/amostras/ | todos |
| Editar amostra | PATCH | /api/amostras/{id}/ | supervisor |
| Confirmar aliquotagem | POST | /api/amostras/receber/ | extracao / supervisor |
| Criar placa (extração ou PCR) | POST | /api/placas/ | extracao / pcr |
| Salvar poços da placa | POST | /api/placas/{id}/salvar-pocos/ | extracao / pcr |
| Buscar amostra elegível (extração) | GET | /api/placas/buscar-amostra/?codigo= | extracao |
| Buscar amostra elegível (PCR) | GET | /api/placas/buscar-amostra/?codigo=&modulo=pcr | pcr |
| Carregar rascunho PCR de extração | GET | /api/placas/{id}/rascunho-pcr/ | pcr |
| Confirmar extração da placa (scan) | POST | /api/placas/confirmar-extracao/ | extracao / supervisor |
| Enviar placa PCR ao termociclador | POST | /api/placas/{id}/submeter/ | pcr / supervisor |
| PDF da placa | GET | /api/placas/{id}/pdf/ | extracao / pcr |
| Importar resultado PCR | POST | /api/resultados/importar/ | pcr / supervisor |
| Confirmar resultados | POST | /api/resultados/{id}/confirmar/ | pcr / supervisor |
| Marcar resultado liberado no GAL | POST | /api/resultados/{id}/liberar/ | pcr / supervisor |
| Histórico de auditoria | GET | /api/amostras/{id}/historico/ | supervisor |

---

### Pendências Técnicas (Bloqueadores de Fase)

| Pendência | Bloqueia | Status |
| :--- | :--- | :--- |
| ~~CSV real do GAL~~ | ~~Início da Fase 2~~ | ✅ Resolvido — formato confirmado, modelo e parser implementados |
| ~~Valores reais de `Status Exame` do GAL~~ | ~~`GAL_STATUS_MAP` em `utils.py`~~ | ✅ Confirmado — 4 valores: Aguardando Triagem, Exame em Análise, Resultado Liberado, Exame Cancelado |
| Critérios IBMP Biomol | Início da Fase 6 | ⏳ Pendente — levantar cutoffs de Cq para CI, HPV16, HPV18 e HPV AR na bula/manual do kit |

---

### Pontos Críticos e Boas Práticas

#### Deploy em Contêineres (Docker)
* Todo o ecossistema (banco, backend, proxy reverso) roda em contêineres Docker, isolando a aplicação da infraestrutura física do servidor, facilitando manutenibilidade, atualizações e futuras migrações ou escalabilidade.

#### Acesso web sem instalação e Importação Segura
* Nenhum software precisa ser instalado nos clientes Windows. O gargalo de importação do GAL é mitigado por uma validação estrita em tela (preview), protegendo o banco de dados contra inconsistências na entrada.

#### Separação Extração / PCR
* Placa de extração e placa de PCR são entidades distintas no banco. A placa de extração é **congelada e rastreada** indefinidamente (pode ser reutilizada em retestes futuros). A placa de PCR é a que vai ao termociclador; pode ser criada a partir de uma extração ou montada do zero com amostras de diferentes extrações.
* O campo `placa_origem` permite rastrear qual extração deu origem a uma placa PCR.

#### Dados Nominativos e Controle de Acesso
* Nome, CPF e CNS dos pacientes são armazenados para uso interno autorizado. O acesso é restrito por perfil (`supervisor` para edição manual; `extracao`/`pcr` apenas para consulta no contexto do fluxo). Dados geográficos e clínicos (município, material) apoiam a vigilância epidemiológica.

#### Rastreabilidade completa e Imutabilidade
* Resultados liberados nunca são sobrescritos (`imutavel=True`). Alterações geram histórico no `audit_log`.
* O fluxo de Repetição de Amostras mantém o registro de todas as tentativas anteriores, cumprindo os requisitos regulatórios para laboratório clínico. O resultado ativo é sempre o último confirmado; o histórico completo é acessível via Admin.

#### Cruzamento de Identidade Amostra ↔ Termociclador
* O parser do CFX Manager cruza resultados por **posição do poço** (ex: `A01`), não por código de amostra. O mapeamento poço → amostra já está registrado no banco desde a montagem da **placa PCR**, eliminando ambiguidade.
