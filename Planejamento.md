# SIGA-LACENRS — Documentação Técnica

Sistema de Informação e Gerenciamento de Amostras do Laboratório de HPV — LACEN/CEVS-RS.

## Arquitetura

Aplicação web conteneirizada com Django 5.1 + PostgreSQL no backend e React 18 no frontend, comunicando-se via API REST com autenticação JWT. O frontend é compilado com Vite e servido pelo Django via django-vite.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│   Nginx      │────▶│   Django    │
│  (React UI) │◀────│ (HTTPS/SSL)  │◀────│  (Gunicorn) │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                │
                                          ┌─────▼─────┐
                                          │ PostgreSQL│
                                          └───────────┘
```

## Apps Django

| App          | Responsabilidade                                            | Models                              |
| ------------ | ----------------------------------------------------------- | ----------------------------------- |
| `usuarios`   | Autenticação por e-mail, login por crachá, grupos de perfil | `Usuario`                           |
| `amostras`   | Registro, importação CSV do GAL, fluxo de status            | `Amostra`                           |
| `placas`     | Montagem de placas de extração e PCR (96 poços)             | `Placa`, `Poco`                     |
| `resultados` | Parser de CSV do CFX Manager, classificação IBMP, revisão   | `ResultadoPoco`, `ResultadoAmostra` |
| `gal_ws`     | Integração SOAP com GAL WebService                          | `GalWsConfig`                       |

## Modelo de Dados

### Amostra

Representa uma amostra de paciente para análise de HPV.

| Campo                   | Tipo                        | Descrição                            |
| ----------------------- | --------------------------- | ------------------------------------ |
| `cod_exame_gal`         | CharField (único)           | Identificador único do exame no GAL  |
| `numero_gal`            | CharField                   | Número da requisição do paciente     |
| `cod_amostra_gal`       | CharField                   | Código da amostra física no GAL      |
| `codigo_interno`        | CharField (único, nullable) | Código LACEN formato N/AA (ex: 1/26) |
| `nome_paciente`         | CharField(200)              | Nome do paciente                     |
| `nome_social`           | CharField(200)              | Nome social (opcional)               |
| `cns`                   | CharField(25)               | Cartão Nacional de Saúde             |
| `cpf`                   | CharField(14)               | CPF                                  |
| `municipio`             | CharField(100)              | Município de residência              |
| `uf`                    | CharField(2)                | UF                                   |
| `unidade_solicitante`   | CharField(200)              | Unidade que solicitou                |
| `municipio_solicitante` | CharField(100)              | Município da unidade solicitante     |
| `material`              | CharField(100)              | Tipo de material coletado            |
| `data_coleta`           | DateTimeField               | Data de cadastro/coleta no GAL       |
| `data_recebimento`      | DateTimeField               | Data de recebimento no LACEN         |
| `status`                | CharField(30)               | Status no fluxo interno              |
| `observacoes`           | TextField                   | Campo livre                          |
| `criado_por`            | FK(Usuario)                 | Usuário que criou                    |
| `recebido_por`          | FK(Usuario)                 | Operador da aliquotagem              |
| `criado_em`             | DateTimeField               | Auto                                 |
| `atualizado_em`         | DateTimeField               | Auto                                 |

### Placa

Placa de 96 poços (8×12) para extração ou PCR.

| Campo                     | Tipo                  | Descrição                                  |
| ------------------------- | --------------------- | ------------------------------------------ |
| `codigo`                  | CharField(20)         | Auto: HPVe{DDMMAA}-{N} ou HPVp{DDMMAA}-{N} |
| `tipo_placa`              | CharField(10)         | `extracao` ou `pcr`                        |
| `placa_origem`            | FK(Placa, nullable)   | Extração de origem (só PCR)                |
| `protocolo`               | CharField(50)         | Protocolo utilizado                        |
| `responsavel`             | FK(Usuario)           | Quem montou                                |
| `extracao_confirmada_por` | FK(Usuario, nullable) | Quem confirmou extração                    |
| `status_placa`            | CharField(30)         | Status da placa                            |
| `observacoes`             | TextField             | Campo livre                                |
| `data_criacao`            | DateTimeField         | Auto                                       |
| `atualizado_em`           | DateTimeField         | Auto                                       |

### Poco

Poço individual de uma placa.

| Campo           | Tipo                  | Descrição                      |
| --------------- | --------------------- | ------------------------------ |
| `placa`         | FK(Placa)             | Placa pertencente              |
| `amostra`       | FK(Amostra, nullable) | Amostra no poço                |
| `posicao`       | CharField(3)          | Formato A01-H12                |
| `tipo_conteudo` | CharField(20)         | `amostra`, `cn`, `cp`, `vazio` |

### ResultadoPoco

Resultado bruto de um canal de PCR por poço.

| Campo                  | Tipo                    | Descrição                                      |
| ---------------------- | ----------------------- | ---------------------------------------------- |
| `poco`                 | FK(Poco)                | Poço de referência                             |
| `canal`                | CharField(10)           | `CI`, `HPV16`, `HPV18`, `HPV_AR`               |
| `cq`                   | FloatField (nullable)   | Valor de Cq                                    |
| `interpretacao`        | CharField(20)           | `positivo`, `negativo`, `invalido`, `pendente` |
| `interpretacao_manual` | CharField(20, nullable) | Override do operador                           |
| `justificativa_manual` | TextField               | Obrigatório se override                        |

### ResultadoAmostra

Resultado consolidado de uma amostra por run.

| Campo             | Tipo                     | Descrição                |
| ----------------- | ------------------------ | ------------------------ |
| `poco`            | OneToOne(Poco)           | Poço do run              |
| `ci_resultado`    | CharField(20)            | Resultado do CI          |
| `hpv16_resultado` | CharField(20)            | Resultado do HPV16       |
| `hpv18_resultado` | CharField(20)            | Resultado do HPV18       |
| `hpvar_resultado` | CharField(20)            | Resultado do HPV_AR      |
| `resultado_final` | CharField(30)            | Resultado consolidado    |
| `confirmado_em`   | DateTimeField (nullable) | Timestamp da confirmação |
| `confirmado_por`  | FK(Usuario, nullable)    | Quem confirmou           |
| `imutavel`        | BooleanField             | True após confirmação    |

### Usuario

Usuário customizado com login por e-mail.

| Campo           | Tipo                           | Descrição             |
| --------------- | ------------------------------ | --------------------- |
| `email`         | EmailField (único)             | E-mail de login       |
| `nome_completo` | CharField(150)                 | Nome completo         |
| `numero_cracha` | CharField(50, único, nullable) | Código do crachá RFID |
| `is_active`     | BooleanField                   | Usuário ativo         |
| `is_staff`      | BooleanField                   | Acesso ao admin       |
| `groups`        | M2M(Group)                     | Grupos de permissão   |

### GalWsConfig

Configuração do GAL WebService (singleton, pk=1).

| Campo                | Tipo           | Descrição                 |
| -------------------- | -------------- | ------------------------- |
| `usuario`            | CharField(100) | Usuário GAL               |
| `senha`              | CharField(255) | Senha GAL                 |
| `codigo_laboratorio` | CharField(50)  | Código do laboratório     |
| `url_ws`             | CharField(255) | URL do WebService         |
| `verificar_ssl`      | BooleanField   | Verificar certificado SSL |

## Fluxo de Status da Amostra

### Status Válidos

| Status               | Valor                  | Descrição                           |
| -------------------- | ---------------------- | ----------------------------------- |
| Aguardando Triagem   | `aguardando_triagem`   | Status inicial (importação GAL)     |
| Exame em Análise     | `exame_em_analise`     | Status refletido do GAL             |
| Aliquotada           | `aliquotada`           | Confirmada no módulo de aliquotagem |
| Extração             | `extracao`             | Adicionada a placa de extração      |
| Extraída             | `extraida`             | Extração confirmada por scan        |
| PCR                  | `pcr`                  | Adicionada a placa PCR              |
| Resultado            | `resultado`            | CSV do termociclador importado      |
| Resultado Liberado   | `resultado_liberado`   | Publicado no GAL                    |
| Cancelada            | `cancelada`            | Status terminal                     |
| Repetição Solicitada | `repeticao_solicitada` | Aguardando reprocessamento          |

### Transições Válidas

```
Aguardando Triagem ──► Exame em Análise
Aguardando Triagem ──► Aliquotada
Aguardando Triagem ──► Cancelada

Exame em Análise ──► Aliquotada
Exame em Análise ──► Cancelada

Aliquotada ──► Extração
Aliquotada ──► Cancelada

Extração ──► Aliquotada (placa excluída)
Extração ──► Extraída
Extração ──► Cancelada

Extraída ──► PCR
Extraída ──► Cancelada

PCR ──► Extraída (placa PCR excluída)
PCR ──► Resultado
PCR ──► Cancelada

Resultado ──► Resultado Liberado
Resultado ──► Repetição Solicitada
Resultado ──► Cancelada

Resultado Liberado ──► Cancelada

Repetição Solicitada ──► PCR
Repetição Solicitada ──► Cancelada

Cancelada ──► (terminal, sem saída)
```

## Perfis de Acesso

| Perfil           | Permissões                                                                 |
| ---------------- | -------------------------------------------------------------------------- |
| **Técnico**      | Importar CSV, aliquotar, montar placas de extração e PCR                   |
| **Especialista** | Tudo do Técnico + submeter ao termociclador + revisar/confirmar resultados |
| **Supervisor**   | Acesso total (is_staff + is_superuser)                                     |

> **Checkpoint de crachá:** Operações de aliquotagem e confirmação de extração exigem scan do crachá físico. Administradores (`is_staff=True`) têm bypass automático.

## Módulos do Sistema

### Importação de Amostras

- Upload de CSV/ZIP exportado pelo GAL
- Detecção automática de formato (clássico ou BMH)
- Preview com classificação: novo, atualizável, duplicado, cancelado
- Importação inteligente: ignora cancelados, atualiza campos ausentes

### Aliquotagem

- Leitura de código de barras (codigo_interno, cod_amostra_gal, cod_exame_gal)
- Checkpoint de crachá obrigatório
- Status → Aliquotada

### Extração

- Espelho de placa 8×12 editável (React)
- Cálculo automático de reagentes (Tampão de Lise, Oligomix, Enzima)
- Exportação em PDF (formulário FR-HPV-001)
- Confirmar extração por scan de código da placa

### PCR

- Criar placa a partir de extração (rascunho) ou do zero
- Amostras elegíveis: Extraída, Resultado, Resultado Liberado, Repetição Solicitada
- Flag visual para amostras com resultado existente (reteste)
- Cálculo de reagentes (Master Mix, Primer Mix)
- Submeter ao termociclador
- Replicata de placa PCR com falha

### Resultados

- Importação de CSV do CFX Manager (Bio-Rad)
- Parser por posição de poço (A01-H12)
- Validação de controles (CP e CN) por critérios IBMP
- Classificação automática por canal (CI: Cq ≤ 33, HPV: Cq ≤ 40)
- Resultado final consolidado (8 genótipos possíveis)
- Override manual com justificativa obrigatória
- Confirmação imutável

### Consulta

- Busca textual por nome, CPF, CNS, códigos
- Filtros por status, município, UF
- Aba de placas com espelho 8×12 expansível

### Integração GAL WebService

- Cliente SOAP via zeep
- Operações: autenticar, buscarExames, marcarExamesEnviados, gravarResultados
- Configuração via painel admin (singleton)

## Frontend

### Entry Points

| Entry             | Página                   | Descrição                     |
| ----------------- | ------------------------ | ----------------------------- |
| `login.jsx`       | `/login/`                | Tela de login                 |
| `import.jsx`      | `/amostras/importar/`    | Importação CSV do GAL         |
| `aliquotagem.jsx` | `/amostras/aliquotagem/` | Módulo de aliquotagem         |
| `plates.jsx`      | `/placas/extracao/`      | Módulo de extração            |
| `pcr.jsx`         | `/placas/pcr/`           | Módulo de PCR                 |
| `consulta.jsx`    | `/amostras/consulta/`    | Consulta de amostras e placas |
| `resultados.jsx`  | `/resultados/revisar/`   | Revisão de resultados         |
| `gal_ws.jsx`      | `/gal-ws/`               | Configuração do GAL WS        |

### Componentes Principais

| Componente              | Descrição                                 |
| ----------------------- | ----------------------------------------- |
| `CrachaInput.jsx`       | Input de crachá com auto-foco e validação |
| `CrachaModal.jsx`       | Modal bloqueante para scan de crachá      |
| `Header.jsx`            | Header com navegação e info do usuário    |
| `NavigationButtons.jsx` | Botões de navegação entre módulos         |
| `PlateEditor.jsx`       | Editor de placa de extração 8×12          |
| `PlacaPCREditor.jsx`    | Editor de placa PCR 8×12                  |

### Design System

- TailwindCSS com tokens customizados
- Fonte: Inter (UI) + JetBrains Mono (códigos)
- Cores: tema LACEN (azul #1a3a5c)

## Testes

36 testes automatizados:

- `apps.amostras.tests`: State machine, permissões (15 testes)
- `apps.placas.tests`: Permissões da API (9 testes)
- `apps.resultados.tests`: Permissões da API (12 testes)

## Roadmap

### Pendente

- [ ] **Critérios IBMP Biomol:** Levantar cutoffs de Cq por canal para classificação automática
- [ ] **Testes E2E:** Fluxo completo Importar → Aliquotar → Extração → PCR → Resultado → Liberar
- [ ] **Histórico de amostra:** Timeline visual de todas as tentativas
- [ ] **Integração GAL completa:** Implementar `marcarExamesEnviados` e `gravarResultados`
- [ ] **Dashboard:** Página inicial com Chart.js, contadores, gráficos
- [ ] **Relatórios:** PDF de resultados por placa, Excel por período
- [ ] **Responsividade:** Adaptar para tablets (uso em bancada)
- [ ] **Filtro por material:** Implementar na consulta de amostras

### Melhorias Técnicas

- [ ] Testes de integração para importação CSV
- [ ] Rate limiting granular
- [ ] Logging estruturado
- [ ] Otimização de queries (select_related/prefetch_related)
- [ ] CI/CD com GitHub Actions
