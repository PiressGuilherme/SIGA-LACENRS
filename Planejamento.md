# SIGA LACEN
## Sistema de Informação e Gerenciamento de Amostras
**Laboratório de HPV LACEN/CEVS** | **Plano de Desenvolvimento (Atualizado)**

---

### Resumo Executivo
Este documento descreve o plano completo para o desenvolvimento do SIGA-LACEN (Sistema de Informação e Gerenciamento de Amostras) para o Laboratório de HPV do LACEN/CEVS. O sistema adota arquitetura web-first conteneirizada: servidor Linux rodando Docker + docker-compose com Django 5 e PostgreSQL, servindo tanto a API REST quanto a interface web, acessível por qualquer navegador na rede local (LAN) sem instalação de software nos clientes Windows. O Django Admin cobre nativamente o módulo de consulta e auditoria. Interfaces mais ricas (espelho de placa, importação de resultados) são entregues como componentes React integrados ao ecossistema via `django-vite`. O desenvolvimento está organizado em 6 fases cobrindo: infraestrutura, registro de amostras, montagem de placas de extração/PCR, importação de resultados, consulta/auditoria e dashboard.

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
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `data_criacao` | DateTimeField | Auto |
| `protocolo` | CharField | Identificador do protocolo utilizado |
| `responsavel` | ForeignKey (User) | Operador que montou a placa |
| `status_placa` | CharField (enum) | Aberta / Submetida ao termociclador / Resultados importados |
| `observacoes` | TextField | Campo livre |

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

#### Módulo de Recebimento
* Tela web dedicada ao recebimento físico e aliquotagem das amostras.
* Operador escaneia o código de barras da alíquota → sistema localiza a amostra pelo `cod_amostra_gal` ou `codigo_interno`.
* Confirmação da alíquota pelo scanner → status da amostra muda para `Aliquotada`.
* Múltiplas amostras podem ser confirmadas em sequência em uma mesma sessão de recebimento.
* Registra data/hora e operador responsável pelo recebimento físico.

#### Montagem de Placa de Extração
* Espelho de placa 8×12 editável como página web (componente React).
* Operador escaneia (ou digita) o `codigo_interno` de cada amostra para atribuí-la a um poço.
* Ao escanear a amostra: ela é automaticamente adicionada à placa que está sendo montada.
* Suporte a controles CN e CP em posições configuráveis pelo operador.
* **Ao salvar a placa:** todas as amostras incluídas recebem status `Extração`. A placa recebe um código próprio (gerado pelo sistema).
* Cálculo automático de volumes de reagentes (Tampão, Oligomix, Enzima).
* Exportação da placa em PDF (formulário FR-HPV-001) via browser.

#### Confirmação de Extração
* Operador escaneia o código da placa após a extração concluída.
* O sistema localiza todas as amostras vinculadas àquela placa e atualiza o status de todas para `Extraída`.
* Ação registrada com data/hora e operador (auditlog).

#### Resultados e Gestão de Repetições
* Upload do CSV exportado do CFX Manager (Bio-Rad) — termociclador único do laboratório.
* **Cruzamento por posição de poço:** O parser identifica amostras pelo poço (`Well A01` → `Poco.posicao A01`), não pelo código interno. A amostra já está mapeada ao poço desde a montagem da placa.
* Ao importar e interpretar com sucesso: status de todas as amostras da placa muda para `Resultado`.
* **Interpretação multi-alvo:** Para cada amostra, os 4 canais são interpretados separadamente (CI, HPV16, HPV18, HPV AR). Regras de classificação por critérios IBMP Biomol HPV Alto Risco (**cutoffs de Cq a definir — ver Pendências Técnicas**).
* Lógica de resultado consolidado:
  * CI inválido → amostra `Inválida`
  * Qualquer canal HPV positivo → `HPV Detectado` (indicando quais genótipos)
  * Todos os canais HPV negativos → `HPV Não Detectado`
* **Tela de revisão:** Usuário visualiza todos os resultados interpretados por poço e por canal antes de confirmar.
* Edição individual na revisão: operador pode corrigir interpretação com justificativa obrigatória.
* **Controles falhos:** Se CN amplificar ou CP não amplificar, o sistema exibe alerta. O operador decide na tela de revisão quais amostras marcar como `Inválidas` ou `Repetição Solicitada`.
* **Gestão de Repetições:** Amostras marcadas para repetição retornam ao status `Aliquotada` para inclusão em nova placa. O histórico de falhas é preservado via `auditlog`.
* Somente após confirmação: `ResultadoAmostra.imutavel = True` — resultados gravados de forma definitiva.
* **Resultado Liberado:** Status final, atualizado quando o resultado for publicado na tabela do GAL.

#### Consulta de Amostras
* Busca avançada no Django Admin (list_filter, search_fields, date_hierarchy).
* Edição manual com campo de justificativa obrigatório.
* Histórico completo de alterações via django-auditlog.
* Visualização do percurso completo da amostra: da entrada ao resultado, incluindo todas as tentativas anteriores (retestes).
* Acesso pelo browser de qualquer máquina da rede LAN.

#### Dashboard
* Gráficos e contadores via aggregations do ORM + Chart.js.
* Página inicial do sistema exibida após login.
* Contadores de amostras por status atual.
* Gráfico de resultados e filtro de período.
* Tabela das últimas placas processadas com link direto para detalhes.
* Alerta de amostras em `Repetição Solicitada` aguardando reprocessamento.

---

### Fluxo de Status da Amostra

```
[GAL CSV] ──► Aguardando Triagem
                    │
                    ▼
             Exame em Análise     (status refletido do GAL)
                    │
          [Módulo de Recebimento]
                    │ scanner confirma alíquota
                    ▼
               Aliquotada
                    │
          [Montagem da Placa]
                    │ placa salva
                    ▼
                Extração
                    │
          [Scan do código da placa]
                    │
                    ▼
                Extraída
                    │
          [Import CSV termociclador]
                    │
                    ▼
               Resultado
                    │
          [Publicação no GAL]
                    │
                    ▼
          Resultado Liberado ✓
```

| # | Status | Gatilho |
|---|---|---|
| 1 | **Aguardando Triagem** | Importação do CSV GAL (status padrão / fallback) |
| 2 | **Exame em Análise** | Importação do CSV GAL (quando Status Exame GAL indica análise) |
| 3 | **Aliquotada** | Scanner confirma alíquota no Módulo de Recebimento |
| 4 | **Extração** | Amostra adicionada à placa; placa salva |
| 5 | **Extraída** | Código da placa escaneado após extração concluída |
| 6 | **Resultado** | CSV do CFX Manager importado e interpretado |
| 7 | **Resultado Liberado** | Resultado publicado na tabela do GAL |

**Status de Exceção:**
* **Cancelada** — Amostra descartada com justificativa; editável apenas por supervisor
* **Repetição Solicitada** — Resultado inválido; amostra retorna ao status `Aliquotada` para inclusão em nova placa

**Rastreabilidade de Retestes:**
Uma amostra pode aparecer em múltiplas placas ao longo do tempo (uma por tentativa). O resultado ativo é sempre o último `ResultadoAmostra` com `imutavel=True`. O histórico completo de todas as tentativas é acessível via `Amostra → Pocos → ResultadoPoco`.

---

### Perfis de Acesso

| Perfil | Permissões |
| :--- | :--- |
| `extracao` | Importar CSV GAL; montar e editar placas; exportar PDF da placa |
| `pcr` | Importar CSV do termociclador; revisar e confirmar resultados |
| `supervisor` | Todas as operações acima + editar amostras manualmente + cancelar amostras + acessar auditoria |

> Todos os perfis autenticados têm acesso ao Dashboard.

---

### Fases de Desenvolvimento

#### Fase 1 - Infraestrutura e Contêineres (2-3 semanas)
* Criar estrutura Docker (Dockerfile e docker-compose.yml) para Python, Django 5, PostgreSQL e Nginx.
* Criar projeto Django com apps base: `amostras`, `placas`, `resultados`, `usuarios`.
* Configurar autenticação JWT com djangorestframework-simplejwt.
* Configurar Django Admin com perfis via Groups (`extracao`, `pcr`, `supervisor`).
* Configurar Nginx com HTTPS (mkcert) na LAN dentro do ambiente Docker.
* Instalar certificado CA mkcert nos browsers dos clientes Windows.

#### Fase 2 - Módulo de Registro Inteligente ✅ Concluída
* ✅ Model `Amostra` atualizado com todos os campos do CSV GAL (nome, CPF, CNS, datas como DateTimeField, etc.)
* ✅ `utils.py` com parser do CSV GAL (encoding Latin-1, separador `;`, mapeamento de colunas, parse de datas)
* ✅ Endpoints DRF implementados:
  * `POST /api/amostras/preview-csv/` — parse sem salvar; retorna preview com `_status_importacao` (novo/duplicado) por linha
  * `POST /api/amostras/importar-csv/` — importação real; ignora duplicatas por `cod_exame_gal`; retorna resumo
* ✅ Django Admin configurado (busca por nome, CPF, CNS, GAL; filtros por status, UF, município; badges coloridos)
* ✅ `StatusAmostra` refatorado para refletir o fluxo real GAL → LACEN (Aguardando Triagem, Exame em Análise, + statuses internos)
* ✅ `GAL_STATUS_MAP` em `utils.py` mapeia `Status Exame` do GAL ao status interno na importação
* ✅ Valores de `Status Exame` do GAL confirmados: Aguardando Triagem, Exame em Análise, Resultado Liberado, Exame Cancelado
* ✅ Tela React de importação (ImportCSV.jsx) — 3 etapas: upload → preview → resultado

#### Fase 3 - Módulo de Recebimento ✅ Concluída (com ressalvas)
* ✅ Tela React de recebimento físico de amostras (`Recebimento.jsx` via django-vite)
* ✅ Operador escaneia código de barras → sistema localiza por `codigo_interno`, `cod_amostra_gal` ou `cod_exame_gal`
* ✅ Confirmação via scanner → status muda para `Aliquotada`
* ✅ Suporte a leitura em sequência (múltiplas alíquotas por sessão com contador)
* ✅ Feedback em tempo real: sucesso (verde), já aliquotada (amarelo), erro (vermelho)
* ✅ Endpoint: `POST /api/amostras/receber/` (action non-detail no ViewSet)
* ⚠️ **Pendente:** Não registra operador do recebimento em campo dedicado (só `atualizado_em` muda; não há `recebido_por` no model)
* ⚠️ **Pendente:** Não verifica perfil `extracao`/`supervisor` — qualquer usuário autenticado pode receber

#### Fase 4 - Montagem de Placa e Extração ⏳ Parcialmente concluída
* ✅ `django-vite` integrado ao projeto
* ✅ Componente React de placa 8×12 editável (`PlateEditor.jsx`):
  * ✅ Leitura de `codigo_interno` por scanner ou digitação
  * ✅ Marcação de poços como CN, CP ou Vazio
  * ✅ Cálculo automático de volumes de reagentes (Tampão, Oligomix, Enzima)
  * ✅ Detecção de duplicatas (mesma amostra na mesma placa)
  * ✅ Limpar poço (botão X ou clique direito)
* ✅ `PlacaViewSet` DRF para criação e persistência da placa e poços
* ✅ Código de barras da placa gerado automaticamente (formato `PL{AAMM}-{NNNN}`)
* ✅ Ao salvar poços: atualização em massa do status das amostras para `Extração`
* ✅ Endpoint para confirmar extração: `POST /api/placas/confirmar-extracao/` → amostras → `Extraída`
* ❌ **Não implementado: Listar/carregar placas existentes** — o frontend só cria novas placas; não há como abrir ou editar uma placa salva anteriormente
* ❌ **Não implementado: Submeter placa ao termociclador** — o método `submeter()` existe no model (`Placa.submeter()`) mas não há endpoint DRF nem botão no frontend. A placa fica com status `ABERTA` mesmo após salvar os poços.
* ❌ **Não implementado: Interface de confirmação de extração** — o endpoint `confirmar-extracao` existe no backend, mas não há tela/seção no frontend para o operador escanear o código da placa e confirmar a extração
* ❌ **Não implementado: Geração de PDF da placa (FR-HPV-001)** — reportlab instalado mas sem implementação
* ❌ **Não implementado: Buscar amostra por outros campos** — `buscar-amostra` só aceita `codigo_interno` exato; não busca por `cod_amostra_gal` ou `cod_exame_gal`

#### Fase 5 - Consulta de Amostras ✅ Concluída
* ✅ Tela React acessível a todos os perfis autenticados (`/amostras/consulta/`)
* ✅ Tabela paginada com todas as amostras do sistema (50 por página)
* ✅ Busca textual por: nome do paciente, CPF, CNS, código interno, número GAL, cód. exame
* ✅ Filtros por: status, município (dropdowns populados via `/api/amostras/filtros/`)
* ✅ Ordenação por colunas clicáveis
* ✅ Badge colorido de status (mesma paleta do Admin)
* ✅ Endpoint DRF com paginação, filtros e busca: `GET /api/amostras/?search=&status=&municipio=&page=`
* ⚠️ **Pendente:** Filtro por UF e material (backend suporta UF, mas não há dropdown no frontend; material não implementado)

---

#### Fase 4B - Completar Placa e Extração (1-2 semanas)
> Itens restantes da Fase 4 que precisam ser implementados antes de avançar para Resultados.

* Listar placas existentes no frontend com filtro por status (aberta/submetida) e busca por código
* Carregar placa salva para edição — ao selecionar, popular o grid com os poços já salvos
* Endpoint e botão "Submeter ao Termociclador":
  * `POST /api/placas/{id}/submeter/` — atualiza status da placa para `SUBMETIDA`
  * No frontend: botão habilitado apenas quando a placa tem poços salvos
  * Placa submetida não pode mais ter poços editados
* Interface de confirmação de extração no frontend:
  * Campo de scanner para código da placa
  * Ao escanear: chama `POST /api/placas/confirmar-extracao/` → amostras → `Extraída`
  * Exibir feedback com lista de amostras atualizadas
* Geração de PDF da placa (FR-HPV-001):
  * Layout: cabeçalho com código da placa, data, responsável
  * Grid 8×12 com código interno + nome do paciente por poço
  * Tabela de reagentes com volumes calculados
  * Endpoint: `GET /api/placas/{id}/pdf/` → download do PDF
  * Botão "Exportar PDF" no frontend
* Ampliar busca de amostra na placa: aceitar `cod_amostra_gal` e `cod_exame_gal` além de `codigo_interno`

#### Fase 5.5 - Consolidação e Qualidade (2 semanas)
> Passos intermediários de consolidação antes de avançar para o módulo de resultados. Essenciais para um sistema de laboratório clínico.

**Testes automatizados:**
* Testes unitários do parser CSV GAL (`parse_gal_csv`, `parse_gal_file`) — cenários: encoding, ZIP, duplicatas, cancelados, datas inválidas
* Testes do fluxo de status da amostra — validar transições permitidas/proibidas
* Testes dos endpoints de importação, recebimento e placas (DRF `APITestCase`)
* Testes do model Placa — geração de código, submissão, confirmação de extração

**Permissões por grupo:**
* Criar permission mixins/decorators que verifiquem grupo do usuário (`extracao`, `pcr`, `supervisor`)
* Aplicar nas views:
  * Import CSV / Recebimento → requer `extracao` ou `supervisor`
  * Montar placa / Confirmar extração → requer `extracao` ou `supervisor`
  * Resultados (futuro) → requer `pcr` ou `supervisor`
  * Edição manual de amostra → requer `supervisor`
  * Cancelar amostra → requer `supervisor`
* Retornar `403 Forbidden` com mensagem clara quando sem permissão

**Ativar django-auditlog:**
* Registrar models com `auditlog.register()`: `Amostra`, `Placa`, `Poco`
* Configurar campos excluídos do log (se necessário)
* Verificar que alterações de status ficam registradas no histórico

**Tela de login dedicada:**
* Página de login própria com autenticação JWT (em vez de redirecionar para `/admin/login/`)
* Formulário: e-mail + senha → obter access + refresh token → salvar em localStorage
* Redirect para página principal após login bem-sucedido
* Rota `/logout/` que limpa tokens e redireciona para login

**Validação de transições de status (state machine):**
* Criar mapa de transições válidas no model `Amostra`:
  * `AGUARDANDO_TRIAGEM` → `ALIQUOTADA`, `CANCELADA`
  * `EXAME_EM_ANALISE` → `ALIQUOTADA`, `CANCELADA`
  * `ALIQUOTADA` → `EXTRACAO`, `CANCELADA`
  * `EXTRACAO` → `EXTRAIDA`, `CANCELADA`
  * `EXTRAIDA` → `RESULTADO`, `CANCELADA`
  * `RESULTADO` → `RESULTADO_LIBERADO`, `REPETICAO_SOLICITADA`, `CANCELADA`
  * `REPETICAO_SOLICITADA` → `ALIQUOTADA`, `CANCELADA`
* Método `Amostra.transitar(novo_status)` que valida a transição antes de aplicar
* Usar em todas as views que alteram status (receber, salvar placa, confirmar extração, etc.)

#### Fase 6 - Módulo de Resultados e Repetição (2-3 semanas)
> **Pré-requisito:** Obter critérios IBMP Biomol (cutoffs de Cq por canal) antes de implementar a lógica de classificação.

* Página web de upload do CSV do CFX Manager.
* Parser formatado para o modelo do CFX Manager (Bio-Rad):
  * Lê metadados do cabeçalho
  * Agrupa linhas por poço
  * Extrai Cq por canal (CI, HPV16, HPV18, HPV_AR)
  * Cruza por `posicao` do poço com a placa salva no banco
* Implementar classificação automática por critérios IBMP Biomol.
* Calcular `resultado_final` consolidado por amostra.
* Ao importar com sucesso: status das amostras da placa → `Resultado`.
* Tela de revisão de resultados com edição individual e justificativa.
* Exibição de alertas para controles falhos; decisão do operador sobre repetições.
* Implementar lógica de **Gestão de Repetições** — voltar amostras para `Aliquotada`.
* Gravação imutável de resultados confirmados (`imutavel=True`).
* Endpoint/ação para marcar resultado como liberado no GAL → status `Resultado Liberado`.

#### Fase 6.5 - Integração e Robustez (1-2 semanas)
> Garantir que o fluxo completo funciona de ponta a ponta antes de avançar para relatórios.

* Testes E2E do fluxo completo: Importar CSV → Receber → Montar Placa → Submeter → Confirmar Extração → Importar Resultado → Confirmar → Liberar
* Fluxo de repetição completo na UI: botão "Solicitar Repetição" na tela de revisão → amostra retorna para `Aliquotada` → inclusão em nova placa
* Visualização do histórico de uma amostra: todas as placas/poços/resultados anteriores acessíveis numa timeline
* Tratamento de erros global no frontend — componente de erro padronizado, loading states consistentes
* Endpoint `GET /api/amostras/{id}/historico/` — retorna timeline completa com todas as tentativas

#### Fase 7 - Auditoria e Relatórios (2 semanas)
* Configuração avançada do Django Admin (filtros e buscas por status, data, município, resultado).
* Tela de auditoria para supervisor: visualizar histórico de alterações por amostra via django-auditlog.
* Visualização completa do histórico de retestes por amostra.
* Relatórios exportáveis:
  * PDF de resultados por placa (laudo consolidado)
  * Excel de resultados por período (exportação para vigilância epidemiológica)
  * PDF da placa de extração (FR-HPV-001) — se não concluído na Fase 4B
* Indicadores para supervisor: amostras pendentes por status, placas abertas, resultados por confirmar
* Testes de integração e documentação técnica

#### Fase 8 - Dashboard e Polish (2 semanas)
* Página inicial com Chart.js (dashboard pós-login).
* Contadores de amostras por status atual (cards com ícones).
* Gráfico de resultados por genótipo e filtro de período.
* Tabela das últimas placas processadas com link direto para detalhes.
* Alertas automáticos de amostras pendentes (`Repetição Solicitada`, amostras paradas há mais de N dias).
* Atalhos rápidos de navegação (importar, receber, montar placa).
* Otimização de estilos: migrar inline styles para CSS modules ou Tailwind para consistência visual.
* Responsividade para tablets (recebimento e montagem de placa são usados no bancada do laboratório).

---

### Arquitetura de Comunicação

| Operação | Método | Endpoint | Perfil requerido |
| :--- | :--- | :--- | :--- |
| Login / obter token | POST | /api/token/ | todos |
| Renovar token | POST | /api/token/refresh/ | todos |
| Preview CSV de amostras | POST | /api/amostras/preview-csv/ | extracao / supervisor |
| Importar CSV de amostras | POST | /api/amostras/importar-csv/ | extracao / supervisor |
| Listar amostras | GET | /api/amostras/ | todos |
| Editar amostra | PATCH | /api/amostras/{id}/ | supervisor |
| Confirmar recebimento (aliquotagem) | POST | /api/amostras/{id}/receber/ | extracao / supervisor |
| Criar placa | POST | /api/placas/ | extracao |
| Salvar poços da placa | POST | /api/placas/{id}/pocos/ | extracao |
| Confirmar extração da placa (scan) | POST | /api/placas/{codigo}/confirmar-extracao/ | extracao / supervisor |
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
| Critérios IBMP Biomol | Início da Fase 5 | ⏳ Pendente — levantar cutoffs de Cq para CI, HPV16, HPV18 e HPV AR na bula/manual do kit |

---

### Pontos Críticos e Boas Práticas

#### Deploy em Contêineres (Docker)
* Todo o ecossistema (banco, backend, proxy reverso) roda em contêineres Docker, isolando a aplicação da infraestrutura física do servidor, facilitando manutenibilidade, atualizações e futuras migrações ou escalabilidade.

#### Acesso web sem instalação e Importação Segura
* Nenhum software precisa ser instalado nos clientes Windows. O gargalo de importação do GAL é mitigado por uma validação estrita em tela (preview), protegendo o banco de dados contra inconsistências na entrada.

#### Dados Nominativos e Controle de Acesso
* Nome, CPF e CNS dos pacientes são armazenados para uso interno autorizado. O acesso é restrito por perfil (`supervisor` para edição manual; `extracao`/`pcr` apenas para consulta no contexto do fluxo). Dados geográficos e clínicos (município, material) apoiam a vigilância epidemiológica.

#### Rastreabilidade completa e Imutabilidade
* Resultados liberados nunca são sobrescritos (`imutavel=True`). Alterações geram histórico no `audit_log`.
* O fluxo de Repetição de Amostras mantém o registro de todas as tentativas anteriores, cumprindo os requisitos regulatórios para laboratório clínico. O resultado ativo é sempre o último confirmado; o histórico completo é acessível via Admin.

#### Cruzamento de Identidade Amostra ↔ Termociclador
* O parser do CFX Manager cruza resultados por **posição do poço** (ex: `A01`), não por código de amostra. O mapeamento poço → amostra já está registrado no banco desde a montagem da placa, eliminando ambiguidade.
