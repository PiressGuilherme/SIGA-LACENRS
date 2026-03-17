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
| Resultados PCR | openpyxl + csv (Python) | Parser de Excel/CSV configurado para o padrão do termociclador local |
| Relatórios | ReportLab + openpyxl | Geração de PDF e Excel para exportação de laudos |

---

### Módulos do Sistema

#### Registro de Amostras
* Upload de arquivo CSV (ex: extração do GAL) pelo browser (página web Django).
* **Tela de pré-visualização (Preview):** Validação estrita onde o sistema analisa o arquivo e exibe um resumo (amostras válidas, duplicadas ou com erro) para confirmação humana antes da inserção no banco de dados.
* Amostras novas inseridas com status Recebida.
* Amostras disponíveis para aliquotagem após registro.
* Listagem e revisão via Django Admin.

#### Extração e Amplificação (Em processamento)
* Espelho de placa 8x12 editável como página web (componente React).
* IDs de amostras aliquotadas inseridos nos poços via interface web.
* Cálculo automático de volumes de reagentes (Tampão, Oligomix, Enzima).
* Suporte a controles CN e CP em posições configuráveis.
* Ao salvar: status das amostras muda para Em processamento.
* Exportação da placa em PDF (modelo FR-HPV-001) via browser.

#### Resultados e Gestão de Repetições
* Upload de planilha Excel (.xlsx) ou CSV exportada do termociclador único do laboratório.
* Parser interpreta automaticamente valores de Ct por poço, cruzando com a placa salva.
* Classificação automática: Positivo / Negativo / Inválido (critérios IBMP Biomol HPV Alto Risco).
* Tela de revisão: usuário visualiza todos os resultados interpretados antes de confirmar. 
* Edição individual permitida na revisão: usuário pode corrigir interpretação com justificativa.
* **Gestão de Repetições:** Se uma amostra for classificada como Inválida (ou falhar nos controles), o operador pode marcá-la para "Repetição" durante a revisão. O sistema mantém o histórico da falha via *auditlog*, mas retorna o status da amostra para `Aliquotada/Recebida` para que ela possa ser incluída na placa do dia seguinte.
* Somente após confirmação os resultados (Positivos/Negativos) são gravados no banco de forma imutável.

#### Consulta de Amostras
* Busca avançada no Django Admin (list_filter, search_fields, date_hierarchy).
* Edição manual com campo de justificativa obrigatório.
* Histórico completo de alterações via django-auditlog.
* Visualização do percurso da amostra da entrada ao resultado.
* Acesso pelo browser de qualquer máquina da rede LAN.

#### Dashboard
* Gráficos e contadores via aggregations do ORM + Chart.js.
* Página inicial do sistema exibida após login.
* Contadores de amostras por status atual.
* Gráfico de resultados e filtro de período.
* Tabela das últimas placas processadas com link direto para detalhes.

---

### Fluxo de Status da Amostra
1. **Recebida** (Pronta para entrar no fluxo)
2. **Aliquotada** (Em loteamento)
3. **Em processamento** (Atribuída a uma Placa)
4. **Amplificada** (Passou pelo termociclador)
5. **Resultado liberado** (Laudo finalizado)
* **Status de Exceção:** Cancelada / **Repetição Solicitada** (Retorna o fluxo para *Recebida/Aliquotada*).

---

### Fases de Desenvolvimento

#### Fase 1 - Infraestrutura e Contêineres (2-3 semanas)
* Criar estrutura Docker (Dockerfile e docker-compose.yml) para Python, Django 5, PostgreSQL e Nginx.
* Criar projeto Django com apps base: amostras, placas, resultados, usuarios.
* Configurar autenticação JWT com djangorestframework-simplejwt.
* Configurar Django Admin com perfis via Groups (extracao, pcr, supervisor).
* Configurar Nginx com HTTPS (mkcert) na LAN dentro do ambiente Docker.
* Instalar certificado CA mkcert nos browsers dos clientes Windows.

#### Fase 2 - Módulo de Registro Inteligente (2 semanas)
* Criar Models Django para as entidades (Amostra, Placa, Poco, Resultado).
* Gerar e aplicar migrations.
* Desenvolver fluxo de upload de CSV com tela de **pré-visualização (Preview)** para validação humana (filtros de duplicidade e formatação do GAL).
* Endpoint POST /api/amostras/importar-csv/ com DRF.
* Configurar Django Admin para gestão base.

#### Fase 3 - Extração/PCR e espelho de placa (3-4 semanas)
* Integrar `django-vite` ao projeto para servir os componentes frontend.
* Página web com componente React de placa 8x12 editável e cálculo automático de reagentes.
* PlacaViewSet DRF para criação, edição e persistência da placa.
* Atualização em massa de status via Amostra.objects.bulk_update().
* Geração de PDF da placa (FR-HPV-001).

#### Fase 4 - Módulo de Resultados e Repetição (2-3 semanas)
* Página web de upload do arquivo do termociclador.
* Parser formatado para o modelo específico do equipamento do laboratório.
* Interpretação automática por critérios IBMP Biomol.
* Tela de revisão de resultados.
* Implementar lógica de **Gestão de Repetições** (voltar amostras inválidas para o status inicial).
* Gravação imutável de resultados confirmados.

#### Fase 5 - Consulta, ajustes e auditoria (2 semanas)
* Configuração avançada do Django Admin (filtros e buscas).
* Integração final do django-auditlog para garantir rastreabilidade regulatória.
* Relatórios exportáveis em PDF/Excel com ReportLab/openpyxl.
* Testes de ponta a ponta e documentação.

#### Fase 6 - Dashboard (1-2 semanas)
* Página inicial com Chart.js.
* Alertas automáticos de amostras pendentes.
* Atalhos rápidos de navegação.

---

### Arquitetura de Comunicação

| Operação | Método | Endpoint | Perfil requerido |
| :--- | :--- | :--- | :--- |
| Login / obter token | POST | /api/token/ | todos |
| Renovar token | POST | /api/token/refresh/ | todos |
| Importar CSV de amostras | POST | /api/amostras/importar-csv/ | extracao/supervisor |
| Listar amostras | GET | /api/amostras/ | todos |
| Editar amostra | PATCH | /api/amostras/{id}/ | supervisor |
| Criar placa | POST | /api/placas/ | extracao |
| Salvar poços da placa | POST | /api/placas/{id}/pocos/ | extracao |
| Importar resultado PCR | POST | /api/resultados/importar/ | pcr/supervisor |
| Histórico de auditoria | GET | /api/amostras/{id}/historico/ | supervisor |

---

### Pontos Críticos e Boas Práticas

#### Deploy em Contêineres (Docker)
* Todo o ecossistema (banco, backend, proxy reverso) roda em contêineres Docker, isolando a aplicação da infraestrutura física do servidor, facilitando manutenibilidade, atualizações e futuras migrações ou escalabilidade.

#### Acesso web sem instalação e Importação Segura
* Nenhum software precisa ser instalado nos clientes Windows. O gargalo de importação do GAL é mitigado por uma validação estrita em tela (preview), protegendo o banco de dados contra inconsistências na entrada.

#### Rastreabilidade completa e Imutabilidade
* Resultados liberados nunca são sobrescritos. Alterações geram histórico no `audit_log`. 
* O fluxo de Repetição de Amostras mantém o registro de falhas anteriores, cumprindo rigorosamente os requisitos regulatórios para laboratório clínico.
