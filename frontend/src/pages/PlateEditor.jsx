import React, { useState, useRef, useEffect, useCallback } from 'react'

// ---- Constantes da placa 8x12 ----
const ROWS = ['A','B','C','D','E','F','G','H']
const COLS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
const ALL_POSITIONS = ROWS.flatMap(r => COLS.map(c => r + c))

const TIPO = { AMOSTRA: 'amostra', CN: 'cn', CP: 'cp', VAZIO: 'vazio' }

const TIPO_COLORS = {
  [TIPO.AMOSTRA]: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  [TIPO.CN]:      { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  [TIPO.CP]:      { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
  [TIPO.VAZIO]:   { bg: '#f9fafb', border: '#e5e7eb', text: '#9ca3af' },
}

// Volumes de reagentes por reação (uL) — placeholders, ajustar com protocolo real
const REAGENTES = [
  { nome: 'Tampão de Lise', vol: 200 },
  { nome: 'Oligomix',       vol: 5 },
  { nome: 'Enzima',         vol: 0.5 },
]

function emptyGrid() {
  return ALL_POSITIONS.map(pos => ({
    posicao: pos,
    tipo_conteudo: TIPO.VAZIO,
    amostra_id: null,
    amostra_codigo: '',
    amostra_nome: '',
  }))
}

// ---- API helpers ----
async function api(url, { csrfToken, method = 'GET', body } = {}) {
  const opts = {
    method,
    headers: { 'X-CSRFToken': csrfToken },
    credentials: 'same-origin',
  }
  if (body) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(url, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw { status: res.status, data }
  return data
}

// ================================================================
export default function PlateEditor({ csrfToken }) {
  const [placa, setPlaca] = useState(null)      // objeto da API após criar
  const [grid, setGrid] = useState(emptyGrid)
  const [modo, setModo] = useState(TIPO.AMOSTRA)
  const [selected, setSelected] = useState(0)   // índice do próximo poço
  const [codigo, setCodigo] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [salva, setSalva] = useState(false)
  const inputRef = useRef()

  useEffect(() => { inputRef.current?.focus() }, [feedback, selected])

  // ---- Contadores ----
  const totalAmostras = grid.filter(w => w.tipo_conteudo === TIPO.AMOSTRA && w.amostra_codigo).length
  const totalCN = grid.filter(w => w.tipo_conteudo === TIPO.CN).length
  const totalCP = grid.filter(w => w.tipo_conteudo === TIPO.CP).length
  const totalReacoes = totalAmostras + totalCN + totalCP

  // Avançar para próximo poço vazio a partir de um índice
  const nextEmpty = useCallback((from = 0) => {
    for (let i = from; i < grid.length; i++) {
      if (grid[i].tipo_conteudo === TIPO.VAZIO) return i
    }
    return -1
  }, [grid])

  // ---- Criar placa ----
  async function criarPlaca() {
    setCarregando(true)
    try {
      const data = await api('/api/placas/', { csrfToken, method: 'POST', body: {} })
      setPlaca(data)
      setFeedback({ tipo: 'sucesso', msg: `Placa ${data.codigo} criada.` })
    } catch (err) {
      setFeedback({ tipo: 'erro', msg: err.data?.detail || 'Erro ao criar placa.' })
    } finally {
      setCarregando(false)
    }
  }

  // ---- Scan / digitar amostra ----
  async function handleScan(e) {
    e.preventDefault()
    const val = codigo.trim()
    if (!val) return

    // Modo CN/CP: não precisa buscar amostra
    if (modo !== TIPO.AMOSTRA) {
      placeControl(modo)
      setCodigo('')
      return
    }

    setCarregando(true)
    setFeedback(null)
    try {
      const amostra = await api(`/api/placas/buscar-amostra/?codigo=${encodeURIComponent(val)}`, { csrfToken })

      // Verificar se já está na placa
      if (grid.some(w => w.amostra_codigo === amostra.codigo_interno)) {
        setFeedback({ tipo: 'aviso', msg: `${amostra.codigo_interno} já está nesta placa.` })
        setCodigo('')
        setCarregando(false)
        return
      }

      // Colocar no poço selecionado (ou no próximo vazio)
      let idx = selected
      if (grid[idx].tipo_conteudo !== TIPO.VAZIO) {
        idx = nextEmpty(0)
      }
      if (idx === -1) {
        setFeedback({ tipo: 'aviso', msg: 'Placa cheia — todos os poços ocupados.' })
        setCodigo('')
        setCarregando(false)
        return
      }

      setGrid(prev => {
        const next = [...prev]
        next[idx] = {
          ...next[idx],
          tipo_conteudo: TIPO.AMOSTRA,
          amostra_id: amostra.id,
          amostra_codigo: amostra.codigo_interno,
          amostra_nome: amostra.nome_paciente,
        }
        return next
      })

      // Avançar seleção
      const ne = nextEmpty(idx + 1)
      setSelected(ne === -1 ? idx : ne)
      setFeedback({ tipo: 'sucesso', msg: `${amostra.codigo_interno} — ${amostra.nome_paciente} → ${ALL_POSITIONS[idx]}` })
      setSalva(false)
    } catch (err) {
      setFeedback({ tipo: 'erro', msg: err.data?.erro || 'Amostra não encontrada.' })
    } finally {
      setCodigo('')
      setCarregando(false)
    }
  }

  // ---- Colocar controle ----
  function placeControl(tipo) {
    let idx = selected
    if (grid[idx].tipo_conteudo !== TIPO.VAZIO) idx = nextEmpty(0)
    if (idx === -1) return

    setGrid(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], tipo_conteudo: tipo, amostra_id: null, amostra_codigo: '', amostra_nome: '' }
      return next
    })
    const ne = nextEmpty(idx + 1)
    setSelected(ne === -1 ? idx : ne)
    setSalva(false)
  }

  // ---- Limpar poço ----
  function clearWell(idx) {
    setGrid(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], tipo_conteudo: TIPO.VAZIO, amostra_id: null, amostra_codigo: '', amostra_nome: '' }
      return next
    })
    setSalva(false)
  }

  // ---- Salvar placa ----
  async function salvarPlaca() {
    if (!placa) return
    setCarregando(true)
    setFeedback(null)

    const pocos = grid
      .filter(w => w.tipo_conteudo !== TIPO.VAZIO)
      .map(w => ({
        posicao: w.posicao,
        tipo_conteudo: w.tipo_conteudo,
        amostra_codigo: w.amostra_codigo || '',
      }))

    try {
      const data = await api(`/api/placas/${placa.id}/salvar-pocos/`, {
        csrfToken, method: 'POST', body: { pocos },
      })
      setPlaca(data)
      setSalva(true)
      setFeedback({ tipo: 'sucesso', msg: `Placa ${data.codigo} salva — ${totalAmostras} amostras em extração.` })
    } catch (err) {
      const erros = err.data?.erros || err.data?.detail
      setFeedback({ tipo: 'erro', msg: Array.isArray(erros) ? erros.join('; ') : (erros || 'Erro ao salvar.') })
    } finally {
      setCarregando(false)
    }
  }

  // ---- Nova placa ----
  function resetar() {
    setPlaca(null)
    setGrid(emptyGrid())
    setSelected(0)
    setFeedback(null)
    setSalva(false)
    setCodigo('')
  }

  // ================================================================
  // Render
  // ================================================================
  return (
    <div style={{ fontFamily: 'inherit' }}>
      <h2 style={{ marginBottom: '0.5rem', fontSize: '1.3rem', color: '#1a3a5c' }}>
        Montar Placa de Extração
      </h2>

      {/* ---- Criar / info da placa ---- */}
      {!placa ? (
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>Crie uma nova placa para começar a montagem.</p>
          <button onClick={criarPlaca} disabled={carregando} style={btnStyle('#1a3a5c')}>
            {carregando ? 'Criando...' : 'Criar Nova Placa'}
          </button>
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          marginBottom: '1rem', flexWrap: 'wrap',
        }}>
          <span style={{
            background: '#1a3a5c', color: '#fff', padding: '0.4rem 1rem',
            borderRadius: 6, fontWeight: 600, fontSize: '1rem', letterSpacing: 1,
          }}>
            {placa.codigo}
          </span>
          <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
            {totalAmostras} amostras | {totalCN} CN | {totalCP} CP | {totalReacoes} reações
          </span>
          {salva && <span style={{ color: '#065f46', fontWeight: 500, fontSize: '0.85rem' }}>Salva</span>}
        </div>
      )}

      {/* ---- Feedback ---- */}
      {feedback && (
        <div style={{ padding: '0.6rem 1rem', borderRadius: 6, marginBottom: '1rem', ...feedbackStyles[feedback.tipo] }}>
          {feedback.msg}
        </div>
      )}

      {placa && (
        <>
          {/* ---- Scanner + modo ---- */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <form onSubmit={handleScan} style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: 280 }}>
              <input
                ref={inputRef}
                type="text"
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                placeholder={modo === TIPO.AMOSTRA ? 'Escanear código da amostra...' : `Clique no poço ou Enter para ${modo === TIPO.CN ? 'CN' : 'CP'}`}
                disabled={carregando}
                autoComplete="off"
                style={{
                  flex: 1, padding: '0.6rem 0.75rem', fontSize: '1rem',
                  border: '2px solid #93c5fd', borderRadius: 6, outline: 'none',
                }}
              />
              <button type="submit" disabled={carregando} style={btnStyle('#1a3a5c')}>
                {modo === TIPO.AMOSTRA ? 'Buscar' : 'Inserir'}
              </button>
            </form>

            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {[TIPO.AMOSTRA, TIPO.CN, TIPO.CP].map(t => (
                <button
                  key={t}
                  onClick={() => setModo(t)}
                  style={{
                    ...btnStyle(modo === t ? TIPO_COLORS[t].border : '#d1d5db'),
                    color: modo === t ? '#fff' : '#374151',
                    padding: '0.5rem 0.75rem', fontSize: '0.8rem',
                  }}
                >
                  {t === TIPO.AMOSTRA ? 'Amostra' : t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* ---- Cálculo de reagentes ---- */}
          {totalReacoes > 0 && (
            <div style={{
              display: 'flex', gap: '1.5rem', marginBottom: '1rem', padding: '0.6rem 1rem',
              background: '#f0f7ff', borderRadius: 6, fontSize: '0.85rem', color: '#1e40af',
              flexWrap: 'wrap',
            }}>
              {REAGENTES.map(r => (
                <span key={r.nome}>
                  <b>{r.nome}:</b> {(totalReacoes * r.vol).toFixed(1)} uL ({r.vol} x {totalReacoes})
                </span>
              ))}
            </div>
          )}

          {/* ---- Grid 8x12 ---- */}
          <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
            <table style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: 28 }} />
                  {COLS.map(c => (
                    <th key={c} style={{ textAlign: 'center', fontSize: '0.75rem', color: '#6b7280', padding: '2px 0 4px' }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, ri) => (
                  <tr key={row}>
                    <td style={{ fontWeight: 600, fontSize: '0.8rem', color: '#6b7280', textAlign: 'center', paddingRight: 4 }}>
                      {row}
                    </td>
                    {COLS.map((col, ci) => {
                      const idx = ri * 12 + ci
                      const w = grid[idx]
                      const colors = TIPO_COLORS[w.tipo_conteudo]
                      const isSelected = idx === selected

                      return (
                        <td key={col} style={{ padding: 1.5 }}>
                          <div
                            onClick={() => {
                              if (w.tipo_conteudo === TIPO.VAZIO) {
                                if (modo !== TIPO.AMOSTRA) {
                                  placeControl(modo)
                                } else {
                                  setSelected(idx)
                                }
                              } else {
                                setSelected(idx)
                              }
                            }}
                            onContextMenu={(e) => { e.preventDefault(); clearWell(idx) }}
                            title={w.amostra_codigo ? `${w.amostra_codigo} — ${w.amostra_nome}` : w.tipo_conteudo}
                            style={{
                              width: 72, height: 48,
                              background: colors.bg,
                              border: `2px solid ${isSelected ? '#1a3a5c' : colors.border}`,
                              borderRadius: 4,
                              display: 'flex', flexDirection: 'column',
                              alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer',
                              fontSize: '0.7rem', lineHeight: 1.2,
                              position: 'relative',
                              boxShadow: isSelected ? '0 0 0 2px #3b82f6' : 'none',
                            }}
                          >
                            {w.tipo_conteudo === TIPO.AMOSTRA && w.amostra_codigo && (
                              <>
                                <span style={{ fontWeight: 700, color: colors.text }}>{w.amostra_codigo}</span>
                                <span style={{ color: '#6b7280', fontSize: '0.6rem', maxWidth: 66, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {w.amostra_nome}
                                </span>
                              </>
                            )}
                            {w.tipo_conteudo === TIPO.CN && <span style={{ fontWeight: 700, color: colors.text }}>CN</span>}
                            {w.tipo_conteudo === TIPO.CP && <span style={{ fontWeight: 700, color: colors.text }}>CP</span>}
                            {w.tipo_conteudo !== TIPO.VAZIO && (
                              <span
                                onClick={(e) => { e.stopPropagation(); clearWell(idx) }}
                                style={{
                                  position: 'absolute', top: 1, right: 3,
                                  color: '#9ca3af', cursor: 'pointer', fontSize: '0.65rem',
                                  lineHeight: 1,
                                }}
                              >
                                x
                              </span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ---- Ações ---- */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={salvarPlaca}
              disabled={carregando || totalAmostras === 0}
              style={{ ...btnStyle('#065f46'), opacity: (carregando || totalAmostras === 0) ? 0.5 : 1 }}
            >
              {carregando ? 'Salvando...' : 'Salvar Placa'}
            </button>
            <button onClick={resetar} style={btnStyle('#6b7280')}>
              Nova Placa
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ---- Styles ----
const btnStyle = (bg) => ({
  background: bg, color: '#fff', border: 'none', padding: '0.6rem 1.25rem',
  borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
})

const feedbackStyles = {
  sucesso: { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' },
  aviso:   { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
  erro:    { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' },
}
