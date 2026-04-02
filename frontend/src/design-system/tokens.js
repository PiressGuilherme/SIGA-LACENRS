/**
 * Tokens de Design — SIGA-LACENRS
 * Fonte única de verdade para cores, tipografia, espaçamento e elevação.
 * 
 * Cores da Bandeira RS usadas em detalhes decorativos (NÃO como cores de fundo de conteúdo).
 * Cores semânticas derivadas da mesma família cromática mas em variações funcionais.
 */

export const colors = {

  // ── Brand RS — cores diretas da bandeira gaúcha ──
  // Usadas em: TopNav (borda inferior tricolor), separadores, detalhes de logo,
  // faixas decorativas de cabeçalho. NÃO usar como cor de fundo de área de conteúdo.
  rs: {
    red:    '#CC2529',   // vermelho da bandeira
    yellow: '#FFC72C',   // amarelo da bandeira
    green:  '#009B3A',   // verde da bandeira
  },

  // ── Brand neutro para UI — base da interface ──
  // Cinza-azulado frio; usado em superfícies, textos de interface e fundos de header.
  brand: {
    900: '#0d1f2d',
    800: '#1a3a5c',   // cor primária da TopNav — preservada
    700: '#1e4976',
    600: '#245d96',
    500: '#2a71b5',
    400: '#5a9fd4',
    300: '#8ec1e8',
    200: '#c4e0f4',
    100: '#e8f3fb',
    50:  '#f4f9fe',
  },

  // ── Neutros (cinzas frios) ──
  neutral: {
    950: '#0a0f14',
    900: '#111827',
    800: '#1f2937',
    700: '#374151',
    600: '#4b5563',
    500: '#6b7280',
    400: '#9ca3af',
    300: '#d1d5db',
    200: '#e5e7eb',
    100: '#f3f4f6',
    50:  '#f9fafb',
    0:   '#ffffff',
  },

  // ── Semânticos — família funcional, distinta da bandeira ──
  // Verde funcional (≠ verde RS #009B3A) — status Aprovado, Liberado
  success: {
    800: '#14532d',
    700: '#15803d',
    500: '#22c55e',
    400: '#4ade80',
    100: '#dcfce7',
    50:  '#f0fdf4',
  },

  // Âmbar funcional (≠ amarelo RS #FFC72C) — status Alerta, Repetição, Em Análise
  warning: {
    700: '#92400e',
    600: '#b45309',
    500: '#f59e0b',
    400: '#fcd34d',
    100: '#fef3c7',
    50:  '#fffbeb',
  },

  // Vermelho funcional (≠ vermelho RS #CC2529) — status Cancelada, HPV Positivo, Erros
  danger: {
    800: '#7f1d1d',
    700: '#b91c1c',
    600: '#e53e3e',
    500: '#fc8181',
    100: '#fee2e2',
    50:  '#fef2f2',
  },

  // Azul informativo (distinto do brand)
  info: {
    700: '#1d4ed8',
    500: '#3b82f6',
    100: '#dbeafe',
    50:  '#eff6ff',
  },

  // Índigo — placas em processamento, PCR em andamento
  processing: {
    700: '#3730a3',
    500: '#6366f1',
    100: '#e0e7ff',
    50:  '#eef2ff',
  },

  // ── Tokens de background ──
  bg: {
    base:    '#f4f6f9',         // body — igual ao atual, preservado
    surface: '#ffffff',         // cards, tabelas, modais
    subtle:  '#f9fafb',         // zebra stripe, inputs desabilitados
    inset:   '#f3f4f6',         // code blocks, áreas recuadas
    overlay: 'rgba(0,0,0,0.55)', // fundos de modais e overlays
  },
}

export const typography = {
  fontFamily: {
    ui:   '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
  },

  // Escala tipográfica: size / lineHeight / fontWeight
  scale: {
    // Hierarquia de títulos
    h1:      { size: '1.75rem',   lh: '2.25rem',  weight: 700 }, // títulos de página
    h2:      { size: '1.375rem',  lh: '1.875rem', weight: 700 }, // seções principais
    h3:      { size: '1.125rem',  lh: '1.625rem', weight: 600 }, // sub-seções, card titles
    h4:      { size: '1rem',      lh: '1.5rem',   weight: 600 }, // labels de grupo
    h5:      { size: '0.875rem',  lh: '1.375rem', weight: 600 }, // micro-headers
    h6:      { size: '0.75rem',   lh: '1.25rem',  weight: 700 }, // all-caps labels

    // Corpo de texto
    bodyLg:  { size: '1rem',      lh: '1.625rem', weight: 400 }, // texto padrão
    bodySm:  { size: '0.875rem',  lh: '1.375rem', weight: 400 }, // texto secundário
    caption: { size: '0.75rem',   lh: '1.25rem',  weight: 400 }, // notas, rodapés
    label:   { size: '0.8125rem', lh: '1.25rem',  weight: 500 }, // labels de formulário

    // Monoespaçado — para IDs, códigos, barcodes
    monoSm:  { size: '0.8125rem', lh: '1.25rem',  weight: 500 }, // IDs em células de tabela
    monoBg:  { size: '1rem',      lh: '1.5rem',   weight: 600 }, // input de scan de código de barras
  },
}

export const spacing = {
  0.5:  '2px',
  1:    '4px',
  1.5:  '6px',
  2:    '8px',
  2.5:  '10px',
  3:    '12px',
  3.5:  '14px',
  4:    '16px',
  5:    '20px',
  6:    '24px',
  7:    '28px',
  8:    '32px',
  9:    '36px',
  10:   '40px',
  12:   '48px',
  14:   '56px',
  16:   '64px',
}

export const radius = {
  sm:   '4px',     // inputs, badges pequenos
  md:   '6px',     // botões, cards pequenos
  lg:   '8px',     // cards, modais internos
  xl:   '12px',    // modais, painéis
  '2xl':'16px',    // overlays de tela cheia
  full: '9999px',  // badges pill, avatares
}

export const shadow = {
  sm:  '0 1px 2px 0 rgba(0,0,0,0.06)',              // cards em repouso
  md:  '0 4px 6px -1px rgba(0,0,0,0.08)',            // dropdowns, tooltips
  lg:  '0 8px 24px -2px rgba(26,58,92,0.12)',         // modais, painéis elevados
  xl:  '0 16px 48px -4px rgba(26,58,92,0.18)',        // overlay de crachá
}

// ── Status do Workflow HPV ──
export const STATUS_CONFIG = {
  aguardando_triagem:   { label: 'Aguardando Triagem', color: 'neutral' },
  exame_em_analise:     { label: 'Em Análise',         color: 'info' },
  aliquotada:           { label: 'Aliquotada',         color: 'brand' },
  extracao:             { label: 'Em Extração',        color: 'warning' },
  extraida:             { label: 'Extraída',           color: 'processing' },
  pcr:                  { label: 'Em PCR',             color: 'processing' },
  resultado:            { label: 'Resultado',          color: 'success' },
  resultado_liberado:   { label: 'Liberado',           color: 'success' },
  cancelada:            { label: 'Cancelada',          color: 'danger' },
  repeticao_solicitada: { label: 'Repetição',          color: 'warning' },
}

// ── Estados de poços da placa ──
export const WELL_COLORS = {
  amostra: { bg: 'bg-info-100',       border: 'border-info-400',       text: 'text-info-700' },
  cp:      { bg: 'bg-warning-100',    border: 'border-warning-400',    text: 'text-warning-700' },
  cn:      { bg: 'bg-neutral-100',    border: 'border-neutral-300',    text: 'text-neutral-500' },
  vazio:   { bg: 'bg-neutral-50',     border: 'border-neutral-200',    text: 'text-neutral-300' },
}

export default {
  colors,
  typography,
  spacing,
  radius,
  shadow,
  STATUS_CONFIG,
  WELL_COLORS,
}