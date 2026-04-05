# PLANEJAMENTOFRONTEND.md

## Planejamento de Redesign Frontend — SIGA-LACENRS

**Sistema de Gerenciamento de Amostras — LACEN/RS (Laboratório HPV)**
**Versão:** 1.0 | **Data:** 2026-04-02 | **Stack:** React 18 + Vite 5 + Tailwind CSS

---

## Sumário

1. [Análise da Complexidade da Migração](#1-análise-da-complexidade-da-migração)
2. [Princípios de Design](#2-princípios-de-design)
3. [Tokens de Design](#3-tokens-de-design)
4. [Biblioteca de Componentes Base](#4-biblioteca-de-componentes-base)
5. [Layout e Estrutura Principal](#5-layout-e-estrutura-principal)
6. [Plano de Implementação Técnico](#6-plano-de-implementação-técnico)
7. [Pontos de Atenção Críticos — O que NÃO Mudar](#7-pontos-de-atenção-críticos--o-que-não-mudar)

---

## 1. Análise da Complexidade da Migração

### 1.1 Mapeamento de Páginas e Componentes

| Arquivo JSX (page)      | Entry Point                          | Div ID            | Complexidade | Mudanças Necessárias                                                             |
| ----------------------- | ------------------------------------ | ----------------- | ------------ | -------------------------------------------------------------------------------- |
| `Login.jsx`             | `entries/login.jsx`                  | `login-app`       | Baixa        | Substituir inline CSS por tokens; manter POST para `/api/auth/token/`            |
| `Recebimento.jsx`       | `entries/recebimento.jsx`            | `recebimento-app` | Média        | Novo `StatusBadge`, `FeedbackBanner`, refatorar tabela de confirmadas            |
| `Aliquotagem.jsx`       | `entries/aliquotagem.jsx`            | `aliquotagem-app` | Média        | Igual Recebimento + integração nova `NavigationBar`                              |
| `ImportCSV.jsx`         | `entries/import.jsx`                 | `import-app`      | Baixa        | Substituir dropzone inline; manter POST multipart para `/api/amostras/importar/` |
| `ConsultaAmostras.jsx`  | `entries/consulta.jsx`               | `consulta-app`    | Alta         | Principal candidato a `DataGrid`; colunas dinâmicas, filtros avançados           |
| `PlateEditor.jsx`       | `entries/plates.jsx`                 | `plates-app`      | Muito Alta   | Orquestra 3 sub-páginas; `PlateViewer 96-well` é o componente mais complexo      |
| `MontarPlaca.jsx`       | (sub-componente de `PlateEditor`)    | —                 | Muito Alta   | Grid 8×12 interativo; reescrever com tokens e componente `PlateViewer`           |
| `ConfirmarExtracao.jsx` | (sub-componente de `PlateEditor`)    | —                 | Média        | Formulário + scan de crachá                                                      |
| `ConsultarPlacas.jsx`   | (sub-componente de `PlateEditor`)    | —                 | Média        | Tabela de placas + ação editar                                                   |
| `PlacaPCREditor.jsx`    | `entries/pcr.jsx`                    | `pcr-app`         | Muito Alta   | Montagem de placa PCR; reusa lógica de `MontarPlaca`                             |
| `MontarPCR.jsx`         | (sub-componente de `PlacaPCREditor`) | —                 | Alta         | Similar ao MontarPlaca com lógica de termociclador                               |
| `ConsultarPCR.jsx`      | (sub-componente de `PlacaPCREditor`) | —                 | Média        | Tabela de placas PCR                                                             |
| `RevisarResultados.jsx` | `entries/resultados.jsx`             | `resultados-app`  | Alta         | Tabela densa com canais HPV; badges de resultado; ação de liberação              |
| `GalWs.jsx`             | `entries/gal_ws.jsx`                 | `gal-ws-app`      | Baixa        | Apenas para superusuários; formulário simples                                    |

**Componentes Compartilhados:**

| Componente              | Localização Atual                      | Migração                                                               |
| ----------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| `Header.jsx`            | `src/components/Header.jsx`            | Substituir completamente pela nova `TopNav` com stepper de workflow    |
| `NavigationButtons.jsx` | `src/components/NavigationButtons.jsx` | Absorvido pela nova `TopNav`; o `FLUXO` object mantém as rotas exatas  |
| `CrachaModal.jsx`       | `src/components/CrachaModal.jsx`       | Migrar para novo sistema de Modal com tokens; lógica de API inalterada |
| `CrachaInput.jsx`       | `src/components/CrachaInput.jsx`       | Extrair como `<BarcodeInput>` reutilizável                             |

### 1.2 Pontos de Integração que NÃO Devem Mudar de resultado final, mas podem ser adaptados se necessário.

```
Backend contracts:

API REST:
  POST /api/auth/token/                → login JWT
  POST /api/auth/token/refresh/        → refresh JWT
  POST /api/auth/logout/               → logout (session)
  GET  /api/auth/validar-cracha/       → validação de operador
  POST /api/amostras/receber/          → recebimento de amostra
  POST /api/amostras/{id}/aliquotar/   → aliquotagem
  POST /api/amostras/importar/         → importação CSV (multipart)
  GET  /api/amostras/                  → listagem com filtros
  GET/POST/PATCH /api/placas/          → CRUD de placas
  POST /api/resultados/revisar/        → revisão de resultados

Auth:
  localStorage keys: 'access_token', 'refresh_token', 'usuario'
  CSRF: lido via cookie 'csrftoken' pela função getCsrfToken()
  data-csrf attribute: injetado via data-csrf="{{ csrf_token }}" em cada div de entrada

Entry points (vite.config.js rollupOptions.input):
  login, import, aliquotagem, plates, pcr, consulta, resultados, gal_ws

Django URL patterns:
  /amostras/importar/, /amostras/aliquotagem/, /amostras/consulta/
  /placas/extracao/, /placas/pcr/, /resultados/revisar/
  /login/, /gal-ws/
```

### 1.3 Avaliação de Risco por Área

| Área                             | Risco | Mitigação                                                             |
| -------------------------------- | ----- | --------------------------------------------------------------------- |
| `PlateViewer` 96 poços           | Alto  | Migrar por último; manter lógica de `FILL_ORDER` e índices intacta    |
| `CrachaModal` / switch de sessão | Alto  | Lógica de `localStorage` + `header-usuario` DOM patch não muda        |
| Importação CSV multipart         | Médio | Não alterar `Content-Type` automático do `FormData`; apenas estilizar |
| `ConsultaAmostras` filtros/sort  | Médio | Preservar parâmetros de query string do backend                       |
| `RevisarResultados` liberação    | Médio | Destructive action — novo dialog de confirmação obrigatório           |
| `Header`/`base.html`             | Baixo | Mudança visual pura; URLs e lógica de logout inalteradas              |

### 1.4 Estratégia: Migração Incremental por Página

A migração será **incremental page-by-page**, nunca big-bang. Cada página é um entry point independente (`createRoot` em uma div isolada), o que elimina dependências entre migrações. A sequência segue do menor risco ao maior:

```
Fase A (Fundação)    → Tailwind + tokens + componentes base
Fase B (Periféricas) → Login → ImportCSV → GalWs
Fase C (Fluxo)       → Recebimento → Aliquotagem → ConfirmarExtracao
Fase D (Consulta)    → ConsultaAmostras → ConsultarPlacas → ConsultarPCR
Fase E (Complexas)   → PlateEditor/MontarPlaca → PlacaPCREditor → RevisarResultados
Fase F (Templates)   → base.html + templates Django individuais
```

---

## 2. Princípios de Design

### 2.1 Filosofia Central

O SIGA-LACENRS é um sistema **Scientific B2B SaaS** de missão crítica. Os usuários — biomédicos e técnicos de laboratório — trabalham turnos longos gerenciando centenas de amostras por dia. Erros têm consequências para diagnósticos de pacientes reais.

**Os quatro pilares:**

**1. Alta densidade, baixa carga cognitiva**
Tabelas devem exibir o máximo de dados sem scroll horizontal em monitores Full HD (1920×1080). Fontes menores são aceitáveis desde que mantida legibilidade (mínimo 12px). Nenhuma informação crítica deve exigir hover para aparecer.

**2. Prevenção de erros com atrito calibrado**
Ações destrutivas (liberar resultado, cancelar amostra, apagar placa) exigem dialog de confirmação com texto explícito descrevendo a consequência. Ações reversíveis (filtros, navegação) devem ser instantâneas. O sistema deve tornar o estado atual inequívoco antes de qualquer ação.

**3. Escaneabilidade de IDs, status e alertas**
Códigos internos (formato `N/AA`) e requisições GAL devem usar fonte monoespaçada (`JetBrains Mono`). Badges de status devem ser coloridos de forma semântica e consistente em todas as páginas. Alertas (erros de validação, avisos de duplicata) devem aparecer no topo do conteúdo, nunca enterrados.

**4. Modo claro obrigatório**
O ambiente laboratorial tem iluminação fluorescente intensa. Interfaces escuras provocam cansaço visual por contraste excessivo. O sistema será exclusivamente light mode. Tokens de cor não devem ter variante dark.

### 2.2 Anti-padrões a Eliminar do Código Atual

- Cores hardcoded dispersas em cada componente (ex: `#1a3a5c`, `#0d6efd`, `#dc3545` repetidos em cada arquivo)
- Status badges com cores inconsistentes entre `Recebimento.jsx` e `Aliquotagem.jsx` — o mesmo status tem cores diferentes nos dois arquivos hoje
- Botões de navegação como elementos flutuantes desconectados do contexto visual
- Inline styles em todos os elementos sem nenhuma reutilização
- Ausência total de sistema de tokens: qualquer mudança de cor exige buscar e substituir em dezenas de arquivos

---

## 3. Tokens de Design

### 3.1 Paleta de Cores

As cores da **Bandeira do Rio Grande do Sul** são a identidade visual do sistema. O vermelho (`#CC2529`), amarelo (`#FFC72C`) e verde (`#009B3A`) são usados diretamente como cores de marca — em detalhes decorativos da TopNav, bordas de acento, separadores e elementos de identidade visual. **Não são substituídos por tons desaturados.**

Para os **alertas e status semânticos**, utiliza-se uma família de cores distinta, derivada da mesma família cromática mas em variações funcionais (mais escuras para texto, mais claras para fundo), garantindo que a identidade decorativa da bandeira não se confunda com feedback do sistema.

```
Bandeira RS:
  Vermelho  → #CC2529   (acento TopNav, borda decorativa)
  Amarelo   → #FFC72C   (acento decorativo, separadores)
  Verde     → #009B3A   (acento decorativo, ícone de logo)
```

```js
// src/design-system/tokens.js

export const colors = {
  // ── Brand RS — cores diretas da bandeira gaúcha ──
  // Usadas em: TopNav (borda inferior tricolor), separadores, detalhes de logo,
  // faixas decorativas de cabeçalho.
  rs: {
    red: "#CC2529", // vermelho da bandeira
    yellow: "#FFC72C", // amarelo da bandeira
    green: "#009B3A", // verde da bandeira
  },

  // ── Brand neutro para UI — base da interface ──
  // Cinza-azulado frio;
  brand: {
    900: "#0d1f2d",
    800: "#1a3a5c", // cor primária da TopNav — preservada
    700: "#1e4976",
    600: "#245d96",
    500: "#2a71b5",
    400: "#5a9fd4",
    300: "#8ec1e8",
    200: "#c4e0f4",
    100: "#e8f3fb",
    50: "#f4f9fe",
  },

  // ── Neutros (cinzas frios) ──
  neutral: {
    950: "#0a0f14",
    900: "#111827",
    800: "#1f2937",
    700: "#374151",
    600: "#4b5563",
    500: "#6b7280",
    400: "#9ca3af",
    300: "#d1d5db",
    200: "#e5e7eb",
    100: "#f3f4f6",
    50: "#f9fafb",
    0: "#ffffff",
  },

  // ── Semânticos — família funcional, distinta da bandeira ──
  // Verde funcional (≠ verde RS #009B3A) — status Aprovado, Liberado
  success: {
    800: "#14532d",
    700: "#15803d",
    500: "#22c55e",
    400: "#4ade80",
    100: "#dcfce7",
    50: "#f0fdf4",
  },

  // Âmbar funcional (≠ amarelo RS #FFC72C) — status Alerta, Repetição, Em Análise
  warning: {
    700: "#92400e",
    600: "#b45309",
    500: "#f59e0b",
    400: "#fcd34d",
    100: "#fef3c7",
    50: "#fffbeb",
  },

  // Vermelho funcional (≠ vermelho RS #CC2529) — status Cancelada, HPV Positivo, Erros
  danger: {
    800: "#7f1d1d",
    700: "#b91c1c",
    600: "#e53e3e",
    500: "#fc8181",
    100: "#fee2e2",
    50: "#fef2f2",
  },

  // Azul informativo (distinto do brand)
  info: {
    700: "#1d4ed8",
    500: "#3b82f6",
    100: "#dbeafe",
    50: "#eff6ff",
  },

  // Índigo — placas em processamento, PCR em andamento
  processing: {
    700: "#3730a3",
    500: "#6366f1",
    100: "#e0e7ff",
    50: "#eef2ff",
  },

  // ── Tokens de background ──
  bg: {
    base: "#f4f6f9", // body — igual ao atual, preservado
    surface: "#ffffff", // cards, tabelas, modais
    subtle: "#f9fafb", // zebra stripe, inputs desabilitados
    inset: "#f3f4f6", // code blocks, áreas recuadas
    overlay: "rgba(0,0,0,0.55)", // fundos de modais e overlays
  },
};
```

### 3.2 Tipografia

```js
export const typography = {
  fontFamily: {
    ui: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
  },

  // Escala tipográfica: size / lineHeight / fontWeight
  scale: {
    // Hierarquia de títulos
    h1: { size: "1.75rem", lh: "2.25rem", weight: 700 }, // títulos de página
    h2: { size: "1.375rem", lh: "1.875rem", weight: 700 }, // seções principais
    h3: { size: "1.125rem", lh: "1.625rem", weight: 600 }, // sub-seções, card titles
    h4: { size: "1rem", lh: "1.5rem", weight: 600 }, // labels de grupo
    h5: { size: "0.875rem", lh: "1.375rem", weight: 600 }, // micro-headers
    h6: { size: "0.75rem", lh: "1.25rem", weight: 700 }, // all-caps labels

    // Corpo de texto
    bodyLg: { size: "1rem", lh: "1.625rem", weight: 400 }, // texto padrão
    bodySm: { size: "0.875rem", lh: "1.375rem", weight: 400 }, // texto secundário
    caption: { size: "0.75rem", lh: "1.25rem", weight: 400 }, // notas, rodapés
    label: { size: "0.8125rem", lh: "1.25rem", weight: 500 }, // labels de formulário

    // Monoespaçado — para IDs, códigos, barcodes
    monoSm: { size: "0.8125rem", lh: "1.25rem", weight: 500 }, // IDs em células de tabela
    monoBg: { size: "1rem", lh: "1.5rem", weight: 600 }, // input de scan de código de barras
  },
};
```

**Uso obrigatório de `JetBrains Mono`:** Todo `codigo_interno` (ex: `224/AA`), número de requisição GAL, ID de placa e sequência de barcode deve usar `font-mono`. Isso aumenta a legibilidade em escaneamento visual de listas densas e reduz erros de leitura de caracteres ambíguos (ex: `0` vs `O`, `1` vs `l`).

### 3.3 Espaçamento

Base unit: **4px**. Escala multiplicativa estrita.

```js
export const spacing = {
  // Notação: chave em unidades Tailwind → valor em pixels
  0.5: "2px",
  1: "4px",
  1.5: "6px",
  2: "8px",
  2.5: "10px",
  3: "12px",
  3.5: "14px",
  4: "16px",
  5: "20px",
  6: "24px",
  7: "28px",
  8: "32px",
  9: "36px",
  10: "40px",
  12: "48px",
  14: "56px",
  16: "64px",
};
```

### 3.4 Raio de Borda e Elevação

```js
export const radius = {
  sm: "4px", // inputs, badges pequenos
  md: "6px", // botões, cards pequenos
  lg: "8px", // cards, modais internos
  xl: "12px", // modais, painéis
  "2xl": "16px", // overlays de tela cheia
  full: "9999px", // badges pill, avatares
};

export const shadow = {
  // Elevação 0 = sem sombra (itens inline, sem flutuação)
  sm: "0 1px 2px 0 rgba(0,0,0,0.06)", // cards em repouso
  md: "0 4px 6px -1px rgba(0,0,0,0.08)", // dropdowns, tooltips
  lg: "0 8px 24px -2px rgba(26,58,92,0.12)", // modais, painéis elevados
  xl: "0 16px 48px -4px rgba(26,58,92,0.18)", // overlay de crachá
};
```

---

## 4. Biblioteca de Componentes Base

**Localização:** `src/design-system/components/`

### 4.1 DataGrid

Tabela densa para listagem de amostras e placas. Usada em `ConsultaAmostras`, `ConsultarPlacas`, `ConsultarPCR`, `RevisarResultados`.

**Estrutura Visual:**

- Cabeçalho fixo (`position: sticky; top: 0`) com fundo `bg-surface` e borda inferior `border-neutral-200`
- Zebra striping: linhas pares recebem `bg-subtle`
- Coluna `codigo_interno` fixada à esquerda (`sticky left-0`) — âncora de escaneabilidade principal
- Indicadores de sort (↑↓) visíveis apenas na coluna ativa; demais colunas sortáveis mostram ↕ em hover
- Paginação no rodapé: "Mostrando X–Y de Z amostras" + botões Anterior/Próxima

**Estados:**

- `loading`: skeleton rows com shimmer animation em 3 colunas
- `empty`: mensagem centralizada com ícone, ex: "Nenhuma amostra encontrada para os filtros aplicados"
- `error`: banner vermelho com botão "Tentar novamente"
- `row:hover`: fundo `brand-50`
- `row:selected`: fundo `info-50`, borda esquerda `2px solid brand-600`

**Interface de referência (TypeScript):**

```tsx
interface ColumnDef<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  width?: string; // ex: '120px', 'auto'
  sticky?: boolean; // fixa à esquerda
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface DataGridProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  totalCount?: number;
  page: number;
  pageSize: number;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort: (key: string) => void;
  onPageChange: (page: number) => void;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}
```

**Implementação Tailwind base:**

```jsx
<div className="overflow-x-auto rounded-lg border border-neutral-200 shadow-sm">
  <table className="w-full min-w-[800px] text-sm border-collapse">
    <thead className="sticky top-0 z-10 bg-white border-b border-neutral-200">
      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
    </thead>
    <tbody>
      <tr className="even:bg-neutral-50 hover:bg-brand-50 cursor-pointer transition-colors duration-100">
        <td className="px-4 py-2.5 font-mono text-sm text-neutral-900">
    </tbody>
  </table>
</div>
```

### 4.2 StatusBadge

Pill de status do fluxo de amostras. Substitui os objetos `STATUS_BADGE` duplicados — e inconsistentes — em `Recebimento.jsx`, `Aliquotagem.jsx` e `ConsultaAmostras.jsx`.

**Mapeamento de estados do workflow HPV:**

```tsx
const STATUS_CONFIG = {
  aguardando_triagem: { label: "Aguardando Triagem", color: "neutral" },
  exame_em_analise: { label: "Em Análise", color: "info" },
  aliquotada: { label: "Aliquotada", color: "brand" },
  extracao: { label: "Em Extração", color: "warning" },
  extraida: { label: "Extraída", color: "processing" },
  pcr: { label: "Em PCR", color: "processing" },
  resultado: { label: "Resultado", color: "success" },
  resultado_liberado: { label: "Liberado", color: "success" }, // variante filled
  cancelada: { label: "Cancelada", color: "danger" },
  repeticao_solicitada: { label: "Repetição", color: "warning" },
};
```

**Variantes:**

- `default` (pill outline): background `{color}-100`, texto `{color}-700`, borda `{color}-200`
- `filled`: background `{color}-600`, texto `white` — para status final `resultado_liberado`
- `dot`: ponto colorido 8px + texto neutro — para células densas de tabela onde a cor já comunica

**Estrutura HTML:**

```jsx
<span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-success-100 text-success-700">
  Liberado
</span>
```

### 4.3 Workflow Stepper / TopNav

Barra de navegação superior substitui o `<header>` atual do `base.html` e o `NavigationButtons.jsx`.

**Layout:**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  SIGA-LACEN  │ Recebimento │ Aliquotagem │ [Extração] │ PCR │ Resultados  João S. [Sair] │
└──────────────────────────────────────────────────────────────────────────────┘
              ↑ concluídas (neutral-300)    ↑ ativa (white)  ↑ futuras (neutral-400)
```

Os itens do stepper são links diretos às URLs Django existentes. O template Django passa o `current_step` para que cada página declare qual etapa está ativa:

```html
<!-- Em cada template Django -->
<div id="plates-app" data-csrf="{{ csrf_token }}" data-step="extracao"></div>
```

**Estados dos itens do stepper:**

- **Concluída** (etapas à esquerda da atual): texto `brand-200`, hover `brand-100`
- **Ativa** (página atual): texto `white`, fundo `brand-700`, `rounded-md`
- **Futura** (etapas à direita): texto `brand-400`, sem link ativo se o usuário não tem permissão

**Nota de implementação:** A `TopNav` principal é implementada no `base.html` com Tailwind (server-rendered), não como componente React. Isso elimina flash de conteúdo não estilizado e mantém a navegação funcional mesmo se o JavaScript falhar.

### 4.4 PlateViewer (96 poços)

O componente mais complexo do sistema. Grid 8 linhas (A–H) × 12 colunas (01–12). Substitui o grid manual de `MontarPlaca.jsx`.

**Estrutura Visual:**

```
     01   02   03  ...  12
  A  [●]  [●]  [●] ... [ ]
  B  [●]  [●]  [●] ... [ ]
  ...
  H  [●]  [●]  [ ] ... [ ]
```

- Container `grid grid-cols-[auto_repeat(12,minmax(0,1fr))]`
- Cada poço: `aspect-square rounded-sm border transition-all`, tamanho mínimo `32px`
- Headers de coluna e row labels em `text-xs font-mono text-neutral-400`
- Legenda abaixo do grid: Amostra / CP / CN / Vazio

**Paleta de estados de poços** (substitui cores hardcoded do `MontarPlaca.jsx`):

```
AMOSTRA  → bg-info-100       border-info-400       text-info-700
CP       → bg-warning-100    border-warning-400    text-warning-700
CN       → bg-neutral-100    border-neutral-300    text-neutral-500
VAZIO    → bg-neutral-50     border-neutral-200    text-neutral-300
```

**Estados interativos:**

- `hover`: borda mais escura + `shadow-sm`
- `selected`: `ring-2 ring-brand-500 ring-offset-1`
- `occupied:hover`: Tooltip com `codigo_interno` (mono), nome do paciente, posição
- `multi-select`: Shift+click ou click+drag para selecionar range de poços

**Variantes de tamanho:**

- `size="sm"`: Para thumbnails em listagem de placas (`ConsultarPlacas`)
- `size="md"`: Para o editor de montagem de placa (`MontarPlaca`, `MontarPCR`)
- `size="lg"`: Para revisão de resultados PCR com dados de canais (`RevisarResultados`)

**Interface de referência:**

```tsx
interface WellData {
  index: number; // 0–95, ordem coluna-major (FILL_ORDER)
  tipo: "amostra" | "cp" | "cn" | "vazio";
  codigo_interno?: string;
  nome_paciente?: string;
  posicao: string; // ex: 'A1', 'H12'
  resultado?: "aprovado" | "reprovado" | "pendente";
}

interface PlateViewerProps {
  wells: WellData[];
  onWellClick?: (index: number) => void;
  onWellsSelect?: (indices: number[]) => void;
  selectedWells?: number[];
  readOnly?: boolean;
  showLegend?: boolean;
  size?: "sm" | "md" | "lg";
}
```

**ATENÇÃO — Lógica crítica a preservar:**

```js
// FILL_ORDER e posições de controle NÃO MUDAM
// Definidos por protocolo laboratorial HPV, não por preferência de UI
const FILL_ORDER = [
  /* colunas de A a H, coluna por coluna */
];
const DEFAULT_CP_IDX = 94; // posição G12
const DEFAULT_CN_IDX = 95; // posição H12
```

### 4.5 MetadataCard

Card de resumo de entidade (Amostra, Placa) com pares `label: valor`.

**Estrutura Visual:**

```
┌─────────────────────────────────────────────┐
│  HPV240326-1         [Em Extração]           │
│  Placa de Extração                           │
│  ─────────────────────────────────────────  │
│  Responsável    Ana Lima                     │
│  Amostras       82 / 94                      │
│  Data           26/03/2024                   │
│                                [Editar]      │
└─────────────────────────────────────────────┘
```

- Labels: `text-neutral-500 text-xs uppercase tracking-wide`
- Valores: `text-neutral-900 text-sm font-medium`
- Valores de ID/código: `font-mono text-sm`
- Card: `bg-white rounded-lg border border-neutral-200 shadow-sm p-5`

**Uso:**

```tsx
<MetadataCard
  title="HPV240326-1"
  subtitle="Placa de Extração"
  badge={<StatusBadge status="extracao" />}
  items={[
    { label: "Responsável", value: "Ana Lima" },
    { label: "Amostras", value: "82 / 94" },
    { label: "Data", value: "26/03/2024" },
  ]}
  actions={[
    <Button variant="outline" size="sm">
      Editar
    </Button>,
  ]}
/>
```

### 4.6 Forms & Inputs

**BarcodeInput**
Input especializado para scan de crachá e código de amostra.

- Fonte `JetBrains Mono`, `text-center`, borda `2px brand-400`, `text-lg`
- Autofocus após cada submit bem-sucedido
- Substitui todos os `<input>` de scan atuais em `Recebimento.jsx`, `Aliquotagem.jsx`, `CrachaInput.jsx`

```jsx
<BarcodeInput
  label="Código da Amostra"
  placeholder="Escanear ou digitar..."
  onSubmit={handleReceber}
  loading={loading}
/>
```

**SearchInput**

- Ícone de lupa interno à esquerda (não sobrepõe texto)
- Botão × de limpar à direita (visível apenas com conteúdo)
- Debounce de 300ms built-in via `useEffect`

**FilterPanel**

- Header clicável "Filtros avançados ▾" com contagem de filtros ativos: "Filtros (2) ▾"
- Estado expandido/colapsado persiste em `sessionStorage`
- Conteúdo: grid de 3–4 colunas com selects e date pickers

**Botões — variantes e uso:**

| Variante         | Uso                                   | Tailwind base                                                    |
| ---------------- | ------------------------------------- | ---------------------------------------------------------------- |
| `primary`        | Ação principal da página (1 por tela) | `bg-brand-800 text-white hover:bg-brand-700 active:bg-brand-900` |
| `secondary`      | Ação secundária relevante             | `bg-brand-100 text-brand-800 hover:bg-brand-200`                 |
| `outline`        | Ação terciária / em cards             | `border border-neutral-300 text-neutral-700 hover:bg-neutral-50` |
| `ghost`          | Ações inline em tabelas               | `text-brand-700 hover:bg-brand-50 px-2`                          |
| `danger`         | Ações destrutivas primárias           | `bg-danger-600 text-white hover:bg-danger-700`                   |
| `danger-outline` | Destrutiva menos proeminente          | `border border-danger-300 text-danger-700 hover:bg-danger-50`    |

**Tokens comuns para todos os botões:**

```
rounded-md font-medium transition-colors focus:outline-none focus:ring-2
focus:ring-brand-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed
```

**Tamanhos:** `sm` (px-3 py-1.5 text-xs), `md` (px-4 py-2 text-sm — padrão), `lg` (px-5 py-2.5 text-base)

### 4.7 ConfirmDialog (Ações Destrutivas)

Modal bloqueante obrigatório para ações irreversíveis. Baseado na estrutura do `CrachaModal.jsx` atual (overlay + card centralizado), mas sem lógica de autenticação.

```tsx
<ConfirmDialog
  open={confirmOpen}
  title="Liberar resultado?"
  description={`Você está prestes a liberar o resultado de ${amostra.codigo_interno}
                (${amostra.nome_paciente}). Esta ação não pode ser desfeita.`}
  confirmLabel="Sim, liberar resultado"
  confirmVariant="danger"
  onConfirm={handleLiberar}
  onCancel={() => setConfirmOpen(false)}
/>
```

**Regra obrigatória:** O texto da `description` SEMPRE inclui identificadores específicos (código interno, nome do paciente, quantidade de itens afetados) para que o operador confirme conscientemente qual entidade está sendo modificada. Frases genéricas como "Tem certeza?" são proibidas.

---

## 5. Layout e Estrutura Principal

### 5.1 TopNav no `base.html`

A TopNav é implementada diretamente no `base.html` com Tailwind (server-rendered), não como componente React. Isso preserva a navegação funcional mesmo antes do JavaScript carregar e elimina flash de layout.

```html
<header
  class="sticky top-0 z-50 h-14 bg-brand-800 border-b border-brand-900
               flex items-center px-6 gap-6 shadow-sm"
>
  <!-- Logo -->
  <a
    href="/"
    class="text-white font-bold text-sm tracking-widest uppercase shrink-0"
  >
    SIGA · LACEN
  </a>

  <!-- Faixa tricolor decorativa — identidade RS (posicionada como borda inferior do header) -->
  <!-- Implementada via border-bottom com gradient: vermelho | amarelo | verde -->
  <!-- style="border-bottom: 3px solid; border-image: linear-gradient(to right, #CC2529 33%, #FFC72C 33% 66%, #009B3A 66%) 1" -->

  <div class="w-px h-5 bg-brand-600 shrink-0"></div>

  <!-- Workflow Stepper -->
  <nav
    class="flex items-center gap-1 flex-1 overflow-x-auto"
    aria-label="Etapas"
  >
    {% for step in nav_steps %}
    <a
      href="{{ step.url }}"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
              whitespace-nowrap transition-colors
              {% if step.active %}bg-brand-700 text-white
              {% elif step.done %}text-brand-300 hover:text-white hover:bg-brand-700
              {% else %}text-brand-400 cursor-default pointer-events-none{% endif %}"
    >
      {% if step.done %}<span class="text-success-400">✓</span>{% endif %} {{
      step.label }}
    </a>
    {% endfor %}
  </nav>

  <!-- User info + logout -->
  <div class="flex items-center gap-3 shrink-0 ml-auto">
    <span class="text-brand-300 text-sm font-medium" id="header-usuario">
      {{ user.get_short_name }}
    </span>
    <button
      onclick="fazerLogout()"
      class="text-brand-400 hover:text-white text-sm transition-colors"
    >
      Sair
    </button>
  </div>
</header>
```

### 5.2 Main Content Area

```html
<main class="max-w-screen-2xl mx-auto px-6 py-6">
  {% block content %}{% endblock %}
</main>
```

`max-w-screen-2xl` (1536px) em vez do `max-width: 1100px` atual do `base.html`. Monitores de laboratório (1920×1080+) devem ter espaço adequado para o `PlateViewer` e tabelas densas sem compressão.

### 5.3 Tabelas e Scroll Horizontal

```html
<!-- Wrapper obrigatório para todas as tabelas densas -->
<div class="overflow-x-auto rounded-lg border border-neutral-200 shadow-sm">
  <table class="w-full min-w-[900px] text-sm border-collapse">
    <!-- min-w garante que a tabela nunca colapsa abaixo do mínimo legível -->
    <!-- A coluna sticky left-0 mantém codigo_interno visível durante scroll -->
  </table>
</div>
```

**Coluna sticky (código interno):**

```jsx
<td
  className="sticky left-0 bg-white even-row:bg-neutral-50 px-4 py-2.5
               font-mono text-sm border-r border-neutral-100 shadow-[2px_0_4px_rgba(0,0,0,0.04)]"
>
  {row.codigo_interno}
</td>
```

### 5.4 Considerações Responsivas

O sistema é **desktop-first**. Não há suporte mobile planejado.

| Breakpoint | Largura  | Comportamento                                                             |
| ---------- | -------- | ------------------------------------------------------------------------- |
| `< 1024px` | < 1024px | Banner de aviso visível; acesso não bloqueado para consultas emergenciais |
| `lg`       | 1024px   | Mínimo suportado para uso operacional (laptops de campo)                  |
| `xl`       | 1280px   | Configuração padrão de estações de trabalho                               |
| `2xl`      | 1536px   | Target principal — monitores de bancada laboratorial                      |

---

## 6. Plano de Implementação Técnico

### Passo 1 — Configurar Tailwind CSS no Projeto Vite Existente

```bash
# No diretório /frontend
npm install -D tailwindcss @tailwindcss/forms postcss autoprefixer
npx tailwindcss init -p
```

`tailwind.config.js`:

```js
import tokens from "./src/design-system/tokens.js";

export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "../backend/templates/**/*.html"],
  theme: {
    extend: {
      colors: tokens.colors,
      fontFamily: tokens.typography.fontFamily,
      spacing: tokens.spacing,
      borderRadius: tokens.radius,
      boxShadow: tokens.shadow,
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
```

`src/index.css` (importado em todos os entry points):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap");
```

**Atualização no `base.html` do Django:**

```html
<head>
  {% load django_vite %} {% vite_asset 'index.css' %}
  <!-- Adicionar esta linha -->
</head>
```

### Passo 2 — Estrutura do Design System

```
src/
  design-system/
    tokens.js                    ← Fonte única de verdade para todos os tokens
    components/
      Button.jsx                 ← 5 variantes + 3 tamanhos
      StatusBadge.jsx            ← Todos os estados do workflow HPV
      DataGrid.jsx               ← Tabela densa com sort/filter/pagination
      PlateViewer.jsx            ← Grid 96-well interativo
      MetadataCard.jsx           ← Card de resumo label:valor
      ConfirmDialog.jsx          ← Dialog de confirmação para ações destrutivas
      BarcodeInput.jsx           ← Input especializado para scan
      SearchInput.jsx            ← Search com debounce
      FilterPanel.jsx            ← Painel colapsável de filtros avançados
    index.js                     ← Re-exports de todos os componentes
```

### Passo 3 — Ordem de Migração das Páginas

**Fase A — Fundação (2–3 dias)**

- Instalar Tailwind, configurar com tokens
- Criar todos os componentes base do design system
- Criar `index.css` compartilhado
- Atualizar `base.html` para incluir novo CSS

**Fase B — Páginas Periféricas (1–2 dias cada)**

1. `Login.jsx` — menor risco; sem dependências complexas; valida visualmente o sistema de tokens
2. `GalWs.jsx` — acesso restrito a superusuários; formulário simples
3. `ImportCSV.jsx` — dropzone + feedback de progresso; manter `FormData` intacto

**Fase C — Fluxo de Entrada (2–3 dias cada)** 4. `Recebimento.jsx` — primeira página com `BarcodeInput` + `StatusBadge` + tabela simples 5. `Aliquotagem.jsx` — mesma estrutura de Recebimento; `CrachaModal` migrado 6. `ConfirmarExtracao.jsx` — formulário + scan

**Fase D — Consultas (3–4 dias cada)** 7. `ConsultaAmostras.jsx` — `DataGrid` completo; maior benefício visual imediato 8. `ConsultarPlacas.jsx` e `ConsultarPCR.jsx`

**Fase E — Componentes Complexos (4–5 dias cada)** 9. `MontarPlaca.jsx` — `PlateViewer` interativo com drag-select 10. `PlacaPCREditor.jsx` / `MontarPCR.jsx` — reusar `PlateViewer` 11. `RevisarResultados.jsx` — tabela densa de canais HPV + `ConfirmDialog` obrigatório

**Fase F — Templates Django (1–2 dias)** 12. `base.html` — nova `TopNav` com Tailwind; remover CSS inline do `<style>` atual 13. Templates individuais — verificar que `data-csrf` e div IDs permanecem inalterados

### Passo 4 — Checklist de Validação por Página Migrada

Para cada página, antes de marcar como concluída:

```
Visual:
[ ] CSS inline completamente removido do arquivo JSX
[ ] Nenhuma cor hardcoded; tudo referencia tokens de design-system/tokens.js
[ ] STATUS_BADGE local removido; usando StatusBadge do design-system
[ ] Sem quebra de layout em 1280px e 1920px de largura

Funcional:
[ ] getCsrfToken() e localStorage keys inalterados
[ ] Fetch calls para /api/* inalteradas (URLs, método HTTP, nomes de campo)
[ ] data-csrf leitura via el.dataset.csrf preservada
[ ] CrachaModal (quando presente) migrado visualmente mas lógica de API inalterada

Teste manual:
[ ] Ação principal da página funciona end-to-end
[ ] Estados de erro e loading visíveis corretamente
[ ] Navegação entre etapas funcional (links do stepper)
[ ] Autenticação JWT preservada (sem redirect inesperado para /login/)
```

---

## 7. Pontos de Atenção Críticos — O que NÃO Mudar

Esta seção define os contratos imutáveis entre frontend e backend. **Qualquer alteração nos itens abaixo requer validação completa e testes de integração antes de ir para produção.**

### 7.1 Contratos de API — Congelados

> Regra: Nenhum refactor de frontend altera URLs, métodos HTTP, nomes de campos em request/response ou status codes esperados.

| Endpoint                    | Método         | Campos críticos do contrato                                                                           |
| --------------------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| `/api/auth/token/`          | POST           | Request: `username`, `password` → Response: `access`, `refresh`                                       |
| `/api/auth/token/refresh/`  | POST           | Request: `refresh` → Response: `access`                                                               |
| `/api/auth/logout/`         | POST           | Header obrigatório: `X-CSRFToken`                                                                     |
| `/api/auth/validar-cracha/` | GET            | Query: `?codigo=`, `?grupos=` → Response: `access`, `refresh`, `usuario`, `nome_completo`, `perfil`   |
| `/api/amostras/receber/`    | POST           | Request: `{ codigo, numero_cracha? }` → Response: `{ sucesso, amostra }` ou `{ aviso }` ou `{ erro }` |
| `/api/amostras/importar/`   | POST           | **Atenção:** `FormData` com campo `arquivo` — NUNCA definir `Content-Type` manualmente                |
| `/api/amostras/`            | GET            | Query params: `?status=`, `?municipio=`, `?search=`, `?ordering=`, `?page=`                           |
| `/api/placas/`              | GET/POST/PATCH | Estrutura de `Placa` e `Poco` inalterada                                                              |
| `/api/resultados/revisar/`  | POST           | Campos de liberação de resultado inalterados                                                          |

### 7.2 Autenticação — Chaves do localStorage

```js
// CONGELADO — estas chaves são lidas em múltiplos componentes
// E também referenciadas no JavaScript inline do base.html (logout)
localStorage.getItem("access_token"); // JWT de acesso
localStorage.getItem("refresh_token"); // JWT de refresh
localStorage.getItem("usuario"); // JSON: { id, nome_completo, is_staff, perfil }

// A função getCsrfToken() em src/utils/auth.js lê o cookie 'csrftoken'
// NÃO reescrever esta função — apenas importar
```

### 7.3 Injeção de CSRF via `data-csrf`

```html
<!-- Em CADA template Django — este padrão NÃO muda -->
<div id="recebimento-app" data-csrf="{{ csrf_token }}"></div>
```

```js
// Em CADA entry point — este padrão NÃO muda
const el = document.getElementById("recebimento-app");
createRoot(el).render(<Recebimento csrfToken={el.dataset.csrf} />);
```

Mesmo que a maioria dos componentes leia o CSRF do cookie via `getCsrfToken()`, o atributo `data-csrf` é o mecanismo de fallback e parte do contrato estabelecido.

### 7.4 Nomes dos Entry Points (vite.config.js)

Os nomes das chaves em `rollupOptions.input` **NÃO PODEM mudar**. O `django-vite` usa esses nomes para gerar as tags `<script>` nos templates.

```js
// CONGELADO — não renomear as chaves
input: {
  login:       'src/entries/login.jsx',
  import:      'src/entries/import.jsx',
  aliquotagem: 'src/entries/aliquotagem.jsx',
  plates:      'src/entries/plates.jsx',
  pcr:         'src/entries/pcr.jsx',
  consulta:    'src/entries/consulta.jsx',
  resultados:  'src/entries/resultados.jsx',
  gal_ws:      'src/entries/gal_ws.jsx',
}
```

### 7.5 IDs de Div nos Templates Django

| Template Django              | Div ID            | Entry Point       |
| ---------------------------- | ----------------- | ----------------- |
| `amostras/aliquotagem.html`  | `aliquotagem-app` | `aliquotagem.jsx` |
| `amostras/importar_csv.html` | `import-app`      | `import.jsx`      |
| `amostras/consulta.html`     | `consulta-app`    | `consulta.jsx`    |
| `placas/montar.html`         | `plates-app`      | `plates.jsx`      |
| `placas/pcr.html`            | `pcr-app`         | `pcr.jsx`         |
| `resultados/revisar.html`    | `resultados-app`  | `resultados.jsx`  |
| `gal_ws/*.html`              | `gal-ws-app`      | `gal_ws.jsx`      |
| `templates/login.html`       | `login-app`       | `login.jsx`       |

### 7.6 URL Patterns Django — Preservados

```
# Nenhuma URL abaixo pode ser alterada (bookmarks de usuários, links internos)
/
/login/
/amostras/importar/
/amostras/aliquotagem/
/amostras/consulta/
/placas/extracao/
/placas/pcr/
/placas/montar/          ← alias legado — preservar
/resultados/revisar/
/gal-ws/
/admin/
/api/                    ← todos os endpoints REST
```

### 7.7 Lógica de Negócio — Não Tocar

| Lógica                                | Arquivo                     | Motivo do Congelamento                                                                       |
| ------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| `FILL_ORDER` (coluna-major)           | `MontarPlaca.jsx` linha ~11 | Ordem de preenchimento da placa validada com protocolo laboratorial HPV                      |
| `DEFAULT_CP_IDX = 94` (G12)           | `MontarPlaca.jsx` linha ~30 | Posição do controle positivo definida pelo protocolo IBMP                                    |
| `DEFAULT_CN_IDX = 95` (H12)           | `MontarPlaca.jsx` linha ~31 | Posição do controle negativo definida pelo protocolo IBMP                                    |
| Switch de sessão no `CrachaModal`     | `CrachaModal.jsx` linha ~52 | Atualiza tokens JWT e DOM ao trocar operador durante turno                                   |
| DOM patch de `#header-usuario`        | `CrachaModal.jsx` linha ~59 | Necessário porque o header é server-rendered; sem this patch o nome do operador não atualiza |
| Lógica de deduplicação no recebimento | `Recebimento.jsx`           | Regra de negócio: amostra existente → aviso, não erro                                        |

### 7.8 Dependências a Instalar

```bash
# Produção — fontes self-hosted como alternativa ao Google Fonts
npm install @fontsource/inter @fontsource/jetbrains-mono

# Dev
npm install -D tailwindcss @tailwindcss/forms postcss autoprefixer

# Opcional — acessibilidade de modais e tooltips (avaliar familiaridade da equipe)
# Se adotado, substitui a implementação manual do CrachaModal e tooltips do PlateViewer
npm install @radix-ui/react-dialog @radix-ui/react-tooltip
```

---

## Apêndice — Referências de Implementação

### Arquivos Críticos a Modificar

| Arquivo                                         | Tipo de Mudança                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| `frontend/vite.config.js`                       | Adicionar entry point `index.css`; tokens como alias             |
| `frontend/src/index.css`                        | Criar: Tailwind directives + import de fontes                    |
| `frontend/tailwind.config.js`                   | Criar: configuração com tokens                                   |
| `frontend/src/design-system/tokens.js`          | Criar: fonte única de verdade                                    |
| `backend/templates/base.html`                   | Atualizar: nova TopNav Tailwind + `{% vite_asset 'index.css' %}` |
| `frontend/src/components/Header.jsx`            | Substituir por `TopNav.jsx` com Tailwind                         |
| `frontend/src/components/NavigationButtons.jsx` | Deprecar; lógica de rotas absorvida pela `TopNav`                |

### Componentes Mais Críticos para Desenvolvimento Correto

1. **`PlateViewer.jsx`** — Alto risco; testar exaustivamente a preservação do `FILL_ORDER`
2. **`CrachaModal.jsx`** (migrado) — Alto risco; DOM patch de `#header-usuario` deve permanecer
3. **`DataGrid.jsx`** — Médio risco; preservar parâmetros de query string para sort/filter do backend

---

_Documento elaborado com base na inspeção direta do codebase SIGA-LACENRS em 02/04/2026._
_Todos os tokens, IDs, URLs e nomes de campo referenciados foram verificados no código-fonte real._
