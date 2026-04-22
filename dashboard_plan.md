# Plano de Implementação — Dashboard SIGA-LACEN

Documento de planejamento para o módulo de Dashboard com indicadores operacionais e de QC do laboratório.

---

## 1. Contexto e Objetivos

O SIGA-LACEN possui hoje registros detalhados de amostras, placas de extração, placas de PCR e resultados, incluindo rastreabilidade por operador via `django-auditlog`. Falta, porém, uma visão consolidada que permita à coordenação e à equipe de QC acompanhar:

- Volume e ritmo de entrada de amostras
- Tempo médio de processamento em cada etapa (TAT — *turnaround time*)
- Distribuição de resultados liberados
- Desempenho por operador, para identificar necessidades de treinamento

O dashboard deve ser uma ferramenta **operacional** (visível diariamente) e de **controle de qualidade** (usada em reuniões periódicas).

---

## 2. Dados Disponíveis

Levantamento dos campos já existentes no modelo de dados relevantes para o dashboard:

| Métrica | Fonte |
|---|---|
| Data de recebimento | `Amostra.data_recebimento` |
| Data de coleta | `Amostra.data_coleta` |
| Criação/import da amostra | `Amostra.criado_em`, `Amostra.criado_por` |
| Confirmação da aliquotagem | `Amostra.recebido_por` + `Amostra.atualizado_em` |
| Montagem da placa | `Placa.data_criacao` + `Placa.responsavel` |
| Extração confirmada | `Placa.extracao_confirmada_por` + `Placa.atualizado_em` |
| PCR submetida | `Placa` tipo `pcr` com `status = SUBMETIDA` (via auditlog) |
| Resultado confirmado | `ResultadoAmostra.confirmado_em` + `confirmado_por` |
| Controles inválidos | `ResultadoAmostra.cp_valido` / `cn_valido` |
| Resultado final | `ResultadoAmostra.resultado_final` |
| Operador por etapa | FKs `responsavel`, `extracao_confirmada_por`, `confirmado_por`, `recebido_por`, `criado_por` |

### Limitações conhecidas

- **Não há timestamp explícito de "início da extração"** — o delta será calculado como `Placa.data_criacao → Placa.atualizado_em` quando `status = extracao_confirmada`.
- **Não há timestamp dedicado para "PCR submetida"** — precisará ser derivado do `auditlog_logentry` (entrada de mudança de status para `SUBMETIDA`) ou, como fallback, do `atualizado_em` da placa PCR no momento da mudança.
- **`recebido_por` representa quem confirmou a aliquotagem**, não o recebimento físico da amostra (este é importado do GAL).

---

## 3. Seções do Dashboard

### 3.1. Resumo Geral (cards no topo)

Linha com 5-6 cards de estatísticas rápidas, cada um comparado com o período anterior:

- Amostras recebidas (hoje / semana / mês)
- Amostras aguardando processamento (quebra por status)
- Resultados liberados no período
- Taxa de positividade geral (% com HPV detectado)
- Taxa de amostras inválidas
- TAT médio (recebimento → resultado liberado)

### 3.2. Recebimento de Amostras ao Longo do Tempo

- **Gráfico de barras ou linha:** contagem de amostras por `data_recebimento`
- **Granularidade:** diária (até 30d) ou semanal (acima de 30d)
- **Filtro:** 7 dias / 30 dias / 90 dias / intervalo customizado
- **Overlay:** linha de média móvel (7 dias) para suavizar variação
- **Comparação:** valor do período anterior com seta ↑↓

### 3.3. Tempos Médios de Processamento

Tabela ou gráfico de barras horizontais mostrando, por etapa:

| Etapa | Cálculo |
|---|---|
| Recebimento → Extração | `Amostra.data_recebimento` → `Placa.atualizado_em` (extração confirmada) |
| Extração → PCR submetida | Extração confirmada → placa PCR submetida |
| PCR → Resultado liberado | PCR submetida → `ResultadoAmostra.confirmado_em` |
| **TAT total** | `data_recebimento` → `confirmado_em` |

Para cada etapa exibir: **média**, **mediana** e **P90** (percentil 90) — a mediana é mais robusta a outliers; o P90 ajuda a identificar amostras "atrasadas".

### 3.4. Resumo de Resultados

- **Gráfico de rosca:** distribuição de `resultado_final` (HPV16, HPV18, HPV_AR, coinfecções, Não Detectado, Inválido, Inconclusivo)
- **Linha de tendência:** taxa de positividade semanal ao longo do período
- **Tabela auxiliar:** contagem absoluta e percentual por tipo de resultado

### 3.5. QC por Operador

Tabela com uma linha por operador ativo, com colunas:

- **Extrações montadas** (como `responsavel` em placa de extração)
- **Extrações confirmadas** (como `extracao_confirmada_por`)
- **Placas PCR montadas** (como `responsavel` em placa PCR)
- **Controles inválidos** (CP ou CN inválido em placas onde foi responsável)
- **% controles inválidos** — com destaque visual (amarelo > 10%, vermelho > 20%)
- **Resultados confirmados** (como `confirmado_por`)
- **Amostras aliquotadas** (como `recebido_por`)

Funcionalidades:

- Filtro por período
- Ordenação por qualquer coluna
- Destaque visual em operadores fora do padrão (threshold configurável)
- Exportação CSV para reuniões de QC

---

## 4. Arquitetura

### 4.1. Backend — novo app `apps/dashboard`

```
backend/apps/dashboard/
├── __init__.py
├── apps.py
├── urls.py
├── views.py           # 5 endpoints de agregação
├── serializers.py     # serialização dos agregados
├── services.py        # lógica de agregação (separada das views)
└── tests/
    ├── test_resumo.py
    ├── test_recebimento.py
    ├── test_tempos.py
    ├── test_resultados.py
    └── test_operadores.py
```

### 4.2. Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/dashboard/resumo/` | Cards do topo |
| GET | `/api/dashboard/recebimento/?periodo=30d` | Série temporal de recebimento |
| GET | `/api/dashboard/tempos/?periodo=30d` | TAT e deltas por etapa |
| GET | `/api/dashboard/resultados/?periodo=30d` | Distribuição de resultados |
| GET | `/api/dashboard/operadores/?periodo=30d` | Métricas QC por operador |

**Parâmetros comuns:** `periodo` (`7d`, `30d`, `90d`, `custom`), `data_inicio`, `data_fim`.

### 4.3. Implementação das agregações

- Usar Django ORM: `annotate`, `aggregate`, `TruncDay`, `TruncWeek`, `Count`, `Avg`
- **Sem raw SQL** — toda agregação via ORM para manter portabilidade
- Para tempos de processamento, usar `ExpressionWrapper` com `F('campo_fim') - F('campo_inicio')`
- Para "PCR submetida", consultar `auditlog.LogEntry` filtrando pela transição de status

### 4.4. Permissões

| Perfil | Acesso |
|---|---|
| `tecnico` | Apenas seções 3.1 a 3.4 (sem métricas por operador) |
| `especialista` | Seções 3.1 a 3.4 + métricas próprias na 3.5 |
| `supervisor` | Acesso completo, incluindo tabela QC de todos os operadores |

Regra aplicada via `permission_classes` customizadas no DRF.

### 4.5. Cache

- Django cache framework (LocMem em dev, Redis se disponível em prod)
- TTL de 5 minutos nos endpoints de série temporal e por operador
- Invalidação manual via endpoint admin (opcional na Fase F)

### 4.6. Frontend — nova entrada Vite

```
frontend/src/
├── entries/
│   └── dashboard.jsx
├── pages/Dashboard/
│   ├── Dashboard.jsx              # layout geral + filtros de período
│   ├── CardResumo.jsx             # cards do topo
│   ├── GraficoRecebimento.jsx     # Chart.js - linha/barra
│   ├── GraficoResultados.jsx      # Chart.js - rosca
│   ├── TabelaTempos.jsx           # TAT e deltas
│   ├── TabelaOperadores.jsx       # QC por operador
│   └── FiltroPeriodo.jsx          # componente compartilhado
├── api/
│   └── dashboard.js               # cliente HTTP para os 5 endpoints
└── hooks/
    └── useDashboard.js            # hook para cache + refetch
```

### 4.7. Biblioteca de gráficos

- `chart.js` + `react-chartjs-2` (novas dependências)
- Justificativa: biblioteca madura, boa documentação, tamanho razoável, suporta os tipos necessários (linha, barra, rosca)
- Alternativa considerada: Recharts (mais "React-native", mas bundle maior)

### 4.8. Rota Django

- URL: `/dashboard/`
- View: `TemplateView` com `template_name = 'dashboard/index.html'`
- Template carrega o entry Vite via `django_vite`
- Proteção: `login_required`

---

## 5. Fases de Entrega

| Fase | Escopo | Prioridade | Estimativa |
|---|---|---|---|
| **A** | Backend: 5 endpoints + serviços de agregação + testes unitários | Alta | 2-3 dias |
| **B** | Frontend: layout geral + cards de resumo + gráfico de recebimento | Alta | 2 dias |
| **C** | Frontend: tabela de tempos médios (TAT) por etapa | Alta | 1 dia |
| **D** | Frontend: gráfico de rosca de resultados + trend de positividade | Média | 1-2 dias |
| **E** | Frontend: tabela QC por operador + permissões + exportação CSV | Média | 2 dias |
| **F** | Filtros avançados (intervalo customizado, comparação período anterior) + invalidação de cache | Baixa | 1 dia |

**Total estimado:** 9-11 dias de desenvolvimento.

---

## 6. Considerações de Performance

- Amostras atuais no banco: verificar volume antes da Fase A para decidir se é necessário denormalizar algum campo (ex: cachear `tempo_extracao` direto em `Placa` ao confirmar)
- Índices recomendados a validar:
  - `Amostra(data_recebimento)` — para agregações temporais
  - `Placa(status_placa, atualizado_em)` — para tempos de extração
  - `ResultadoAmostra(confirmado_em)` — para TAT
- Se necessário, considerar uma tabela materializada (view ou modelo) atualizada por signal para métricas pesadas

---

## 7. Critérios de Aceitação

- [ ] Dashboard acessível em `/dashboard/` para usuários autenticados
- [ ] Cards do topo carregam em < 2s
- [ ] Gráfico de recebimento suporta filtro de 7d/30d/90d
- [ ] Tabela de tempos mostra média, mediana e P90 para as 3 etapas
- [ ] Tabela QC destaca operadores com > 10% de controles inválidos
- [ ] Permissões respeitadas por perfil (técnico/especialista/supervisor)
- [ ] Testes cobrem cálculo de TAT, filtros de período e permissões
- [ ] Cache funcional com TTL de 5 minutos

---

## 8. Próximos Passos

1. Validar este plano com o time e ajustar prioridades
2. Criar branch `feature/dashboard`
3. Iniciar Fase A (backend): criar app `dashboard`, definir serviços de agregação e implementar o primeiro endpoint (`/api/dashboard/resumo/`)
4. Ao concluir a Fase A, expor os endpoints em desenvolvimento para validação manual antes de iniciar o frontend
