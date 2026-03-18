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
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `numero_gal` | CharField (único) | Identificador do paciente no GAL — anonimizado, sem dado nominativo |
| `codigo_interno` | CharField (único) | Código do laboratório no formato `N/AA` (ex: `1/26` = amostra 1 do ano 2026) |
| `data_coleta` | DateField | Do CSV do GAL |
| `data_recebimento` | DateField | Data de chegada ao LACEN |
| `sexo` | CharField | Dado clínico (a confirmar com CSV real do GAL) |
| `idade` | IntegerField | Dado clínico |
| `municipio` | CharField | Origem da amostra |
| `cid` | CharField | Classificação clínica |
| `status` | CharField (enum) | Ver Fluxo de Status |
| `criado_em` | DateTimeField | Auto |
| `atualizado_em` | DateTimeField | Auto |

> **Nota de privacidade (LGPD):** Nenhum campo nominativo (nome, CPF, data de nascimento) é armazenado. O `numero_gal` é o único vínculo ao paciente. Campos exatos a confirmar quando o CSV real do GAL estiver disponível.

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

#### Registro de Amostras
* Upload de arquivo CSV do GAL pelo browser (página web Django).
* **Tela de pré-visualização (Preview):** Validação estrita onde o sistema analisa o arquivo e exibe um resumo (amostras válidas, duplicadas ou com erro) para confirmação humana antes da inserção no banco de dados.
* Amostras novas inseridas com status `Recebida`.
* Amostras disponíveis para aliquotagem após registro.
* Listagem e revisão via Django Admin.

#### Extração e Amplificação (Em processamento)
* Espelho de placa 8x12 editável como página web (componente React).
* Operador atribui amostras (`codigo_interno`) aos poços via interface web.
* Ao adicionar uma amostra ao poço: status da amostra muda automaticamente para `Aliquotada`.
* Cálculo automático de volumes de reagentes (Tampão, Oligomix, Enzima).
* Suporte a controles CN e CP em posições configuráveis pelo operador.
* Ao salvar a placa: status das amostras muda para `Em processamento`.
* Exportação da placa em PDF (formulário FR-HPV-001, layout definido pelo sistema) via browser.

#### Resultados e Gestão de Repetições
* Upload do CSV exportado do CFX Manager (Bio-Rad) — termociclador único do laboratório.
* **Cruzamento por posição de poço:** O parser identifica amostras pelo poço (`Well A01` → `Poco.posicao A01`), não pelo código interno. A amostra já está mapeada ao poço desde a montagem da placa.
* Ao importar com sucesso: status de todas as amostras da placa muda para `Amplificada`.
* **Interpretação multi-alvo:** Para cada amostra, os 4 canais são interpretados separadamente (CI, HPV16, HPV18, HPV AR). Regras de classificação por critérios IBMP Biomol HPV Alto Risco (**cutoffs de Cq a definir — ver Pendências Técnicas**).
* Lógica de resultado consolidado:
  * CI inválido → amostra `Inválida`
  * Qualquer canal HPV positivo → `HPV Detectado` (indicando quais genótipos)
  * Todos os canais HPV negativos → `HPV Não Detectado`
* **Tela de revisão:** Usuário visualiza todos os resultados interpretados por poço e por canal antes de confirmar.
* Edição individual na revisão: operador pode corrigir interpretação com justificativa obrigatória.
* **Controles falhos:** Se CN amplificar ou CP não amplificar, o sistema exibe alerta. O operador decide na tela de revisão quais amostras marcar como `Inválidas` ou `Repetição Solicitada`.
* **Gestão de Repetições:** Amostras marcadas para repetição retornam ao status `Aliquotada/Recebida` para inclusão em nova placa. O histórico de falhas é preservado via `auditlog`.
* Somente após confirmação: `ResultadoAmostra.imutavel = True` — resultados gravados de forma definitiva.

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

1. **Recebida** — Amostra importada do GAL; pronta para entrar no fluxo
2. **Aliquotada** — Amostra atribuída a um poço de placa (status definido automaticamente ao montar a placa)
3. **Em processamento** — Placa salva e submetida ao termociclador
4. **Amplificada** — CSV do termociclador importado com sucesso para a placa da amostra
5. **Resultado liberado** — ResultadoAmostra confirmado e imutável

**Status de Exceção:**
* **Cancelada** — Amostra descartada com justificativa; editável apenas por supervisor
* **Repetição Solicitada** — Resultado inválido; amostra retorna ao fluxo a partir de `Aliquotada`

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

#### Fase 2 - Módulo de Registro Inteligente (2 semanas)
> **Pré-requisito:** Obter exemplo real do CSV do GAL para confirmar campos exatos do model `Amostra`.

* Criar Models Django conforme o Modelo de Dados descrito acima.
* Gerar e aplicar migrations.
* Desenvolver fluxo de upload de CSV com tela de **pré-visualização (Preview)** — validação de duplicidade (`numero_gal`) e formatação.
* Endpoint `POST /api/amostras/importar-csv/` com DRF.
* Configurar Django Admin para gestão base das amostras.

#### Fase 3 - Extração/PCR e espelho de placa (3-4 semanas)
* Integrar `django-vite` ao projeto para servir os componentes frontend.
* Página web com componente React de placa 8x12 editável:
  * Drag-and-drop ou digitação de `codigo_interno` por poço
  * Marcação de poços como CN, CP ou Vazio
  * Cálculo automático de volumes de reagentes
* `PlacaViewSet` DRF para criação, edição e persistência da placa e poços.
* Atualização em massa de status via `Amostra.objects.bulk_update()`.
* Geração de PDF da placa (FR-HPV-001) — layout definido pelo sistema.

#### Fase 4 - Módulo de Resultados e Repetição (2-3 semanas)
> **Pré-requisito:** Obter critérios IBMP Biomol (cutoffs de Cq por canal) antes de implementar a lógica de classificação.

* Página web de upload do CSV do CFX Manager.
* Parser formatado para o modelo do CFX Manager (Bio-Rad):
  * Lê metadados do cabeçalho
  * Agrupa linhas por poço
  * Extrai Cq por canal (CI, HPV16, HPV18, HPV_AR)
  * Cruza por `posicao` do poço com a placa salva no banco
* Implementar classificação automática por critérios IBMP Biomol.
* Calcular `resultado_final` consolidado por amostra.
* Tela de revisão de resultados com edição individual e justificativa.
* Exibição de alertas para controles falhos; decisão do operador sobre repetições.
* Implementar lógica de **Gestão de Repetições** — voltar amostras para `Aliquotada`.
* Gravação imutável de resultados confirmados (`imutavel=True`).

#### Fase 5 - Consulta, ajustes e auditoria (2 semanas)
* Configuração avançada do Django Admin (filtros e buscas por status, data, município, resultado).
* Integração final do django-auditlog para garantir rastreabilidade regulatória.
* Visualização completa do histórico de retestes por amostra.
* Relatórios exportáveis em PDF/Excel com ReportLab/openpyxl.
* Testes de ponta a ponta e documentação.

#### Fase 6 - Dashboard (1-2 semanas)
* Página inicial com Chart.js.
* Contadores e gráficos de resultados por genótipo.
* Alertas automáticos de amostras pendentes (`Repetição Solicitada`).
* Atalhos rápidos de navegação.

---

### Arquitetura de Comunicação

| Operação | Método | Endpoint | Perfil requerido |
| :--- | :--- | :--- | :--- |
| Login / obter token | POST | /api/token/ | todos |
| Renovar token | POST | /api/token/refresh/ | todos |
| Importar CSV de amostras | POST | /api/amostras/importar-csv/ | extracao / supervisor |
| Listar amostras | GET | /api/amostras/ | todos |
| Editar amostra | PATCH | /api/amostras/{id}/ | supervisor |
| Criar placa | POST | /api/placas/ | extracao |
| Salvar poços da placa | POST | /api/placas/{id}/pocos/ | extracao |
| Importar resultado PCR | POST | /api/resultados/importar/ | pcr / supervisor |
| Confirmar resultados | POST | /api/resultados/{id}/confirmar/ | pcr / supervisor |
| Histórico de auditoria | GET | /api/amostras/{id}/historico/ | supervisor |

---

### Pendências Técnicas (Bloqueadores de Fase)

| Pendência | Bloqueia | Ação necessária |
| :--- | :--- | :--- |
| CSV real do GAL | Início da Fase 2 | Obter arquivo de exemplo do sistema GAL para confirmar campos exatos |
| Critérios IBMP Biomol | Início da Fase 4 | Levantar cutoffs de Cq para CI, HPV16, HPV18 e HPV AR na bula/manual do kit |

---

### Pontos Críticos e Boas Práticas

#### Deploy em Contêineres (Docker)
* Todo o ecossistema (banco, backend, proxy reverso) roda em contêineres Docker, isolando a aplicação da infraestrutura física do servidor, facilitando manutenibilidade, atualizações e futuras migrações ou escalabilidade.

#### Acesso web sem instalação e Importação Segura
* Nenhum software precisa ser instalado nos clientes Windows. O gargalo de importação do GAL é mitigado por uma validação estrita em tela (preview), protegendo o banco de dados contra inconsistências na entrada.

#### Anonimização e Conformidade (LGPD)
* Nenhum dado nominativo (nome, CPF, data de nascimento) é armazenado. O `numero_gal` é o único vínculo ao paciente, mantido no sistema GAL externo. Dados clínicos não-nominativos (sexo, idade, município, CID) podem ser armazenados para fins de vigilância epidemiológica.

#### Rastreabilidade completa e Imutabilidade
* Resultados liberados nunca são sobrescritos (`imutavel=True`). Alterações geram histórico no `audit_log`.
* O fluxo de Repetição de Amostras mantém o registro de todas as tentativas anteriores, cumprindo os requisitos regulatórios para laboratório clínico. O resultado ativo é sempre o último confirmado; o histórico completo é acessível via Admin.

#### Cruzamento de Identidade Amostra ↔ Termociclador
* O parser do CFX Manager cruza resultados por **posição do poço** (ex: `A01`), não por código de amostra. O mapeamento poço → amostra já está registrado no banco desde a montagem da placa, eliminando ambiguidade.
