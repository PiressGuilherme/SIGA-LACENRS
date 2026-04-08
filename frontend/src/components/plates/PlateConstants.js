export const ROWS = ['A','B','C','D','E','F','G','H']
export const COLS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
export const ALL_POSITIONS = ROWS.flatMap(r => COLS.map(c => r + c))

// Ordem de preenchimento vertical (coluna-major): A01, B01...H01, A02, B02...
export const FILL_ORDER = []
for (let ci = 0; ci < 12; ci++) {
  for (let ri = 0; ri < 8; ri++) {
    FILL_ORDER.push(ri * 12 + ci)
  }
}
export const FILL_POS = new Array(96)
FILL_ORDER.forEach((gridIdx, fillPos) => { FILL_POS[gridIdx] = fillPos })

export const TIPO = { AMOSTRA: 'amostra', CN: 'cn', CP: 'cp', VAZIO: 'vazio' }

export const DEFAULT_CP_IDX = 6 * 12 + 11  // G12
export const DEFAULT_CN_IDX = 7 * 12 + 11  // H12

export function emptyGrid(extraDefaults = {}) {
  const g = ALL_POSITIONS.map(pos => ({
    posicao: pos,
    tipo_conteudo: TIPO.VAZIO,
    amostra_id: null,
    amostra_codigo: '',
    ...extraDefaults,
  }))
  g[DEFAULT_CP_IDX] = { ...g[DEFAULT_CP_IDX], tipo_conteudo: TIPO.CP }
  g[DEFAULT_CN_IDX] = { ...g[DEFAULT_CN_IDX], tipo_conteudo: TIPO.CN }
  return g
}

export function gridFromPocos(pocos, extraDefaults = {}) {
  const g = ALL_POSITIONS.map(pos => ({
    posicao: pos,
    tipo_conteudo: TIPO.VAZIO,
    amostra_id: null,
    amostra_codigo: '',
    ...extraDefaults,
  }))
  for (const poco of pocos) {
    const idx = ALL_POSITIONS.indexOf(poco.posicao)
    if (idx === -1) continue
    g[idx] = {
      posicao: poco.posicao,
      tipo_conteudo: poco.tipo_conteudo,
      amostra_id: poco.amostra || null,
      amostra_codigo: poco.amostra_codigo || '',
      ...Object.fromEntries(
        Object.keys(extraDefaults).map(k => [k, poco[k] ?? extraDefaults[k]])
      ),
    }
  }
  return g
}

export const btnStyle = (bg) => ({
  background: bg, color: '#fff', border: 'none', padding: '0.6rem 1.25rem',
  borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
})

export const feedbackStyles = {
  sucesso: { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' },
  aviso:   { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
  erro:    { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' },
}
