import { useState, useRef, useCallback, useEffect } from 'react'

// ---- Constantes da placa 8x12 ----
const ROWS = ['A','B','C','D','E','F','G','H']
const COLS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
const ALL_POSITIONS = ROWS.flatMap(r => COLS.map(c => r + c))

// Ordem de preenchimento vertical (coluna-major): A01, B01, C01...H01, A02, B02...
const FILL_ORDER = []
for (let ci = 0; ci < 12; ci++) {
  for (let ri = 0; ri < 8; ri++) {
    FILL_ORDER.push(ri * 12 + ci)
  }
}
const FILL_POS = new Array(96)
FILL_ORDER.forEach((gridIdx, fillPos) => { FILL_POS[gridIdx] = fillPos })

const TIPO = { AMOSTRA: 'amostra', CN: 'cn', CP: 'cp', VAZIO: 'vazio' }

const TIPO_COLORS = {
  [TIPO.AMOSTRA]: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  [TIPO.CN]:      { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  [TIPO.CP]:      { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
  [TIPO.VAZIO]:   { bg: '#f9fafb', border: '#e5e7eb', text: '#9ca3af' },
}

const DEFAULT_CP_IDX = 6 * 12 + 11  // G12
const DEFAULT_CN_IDX = 7 * 12 + 11  // H12

const REAGENTES = [
  { nome: 'Tampão de Lise', vol: 200 },
  { nome: 'Oligomix',       vol: 5 },
  { nome: 'Enzima',         vol: 0.5 },
]

const STATUS_PLACA = {
  aberta:                { bg: '#0d6efd', label: 'Aberta' },
  extracao_confirmada:   { bg: '#6f42c1', label: 'Extração confirmada' },
  submetida:             { bg: '#fd7e14', label: 'Submetida' },
  resultados_importados: { bg: '#198754', label: 'Resultados' },
}

function emptyGrid() {
  const g = ALL_POSITIONS.map(pos => ({
    posicao: pos,
    tipo_conteudo: TIPO.VAZIO,
    amostra_id: null,
    amostra_codigo: '',
  }))
  g[DEFAULT_CP_IDX] = { ...g[DEFAULT_CP_IDX], tipo_conteudo: TIPO.CP }
  g[DEFAULT_CN_IDX] = { ...g[DEFAULT_CN_IDX], tipo_conteudo: TIPO.CN }
  return g
}

function gridFromPocos(pocos) {
  const g = ALL_POSITIONS.map(pos => ({
    posicao: pos,
    tipo_conteudo: TIPO.VAZIO,
    amostra_id: null,
    amostra_codigo: '',
  }))
  for (const poco of pocos) {
    const idx = ALL_POSITIONS.indexOf(poco.posicao)
    if (idx === -1) continue
    g[idx] = {
      posicao: poco.posicao,
      tipo_conteudo: poco.tipo_conteudo,
      amostra_id: poco.amostra || null,
      amostra_codigo: poco.amostra_codigo || '',
    }
  }
  return g
}

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
export default function MontarPlaca({ csrfToken, editarPlacaId = null, onEditarDone }) {
  // ---- State: lista de placas ----
  const [placas, setPlacas] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [showList, setShowList] = useState(false)
  const [searchPlacas, setSearchPlacas] = useState('')
  const [statusFilterPlacas, setStatusFilterPlacas] = useState('')

  // ---- State: editor ----
  const [placa, setPlaca] = useState(null)
  const [grid, setGrid] = useState(emptyGrid)
  const [modo, setModo] = useState(TIPO.AMOSTRA)
  const [selected, setSelected] = useState(FILL_ORDER[0])
  const [codigo, setCodigo] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [salva, setSalva] = useState(false)
  const [pendingDuplicate, setPendingDuplicate] = useState(null)
  const inputRef = useRef()

  // Foco automático no input após cada scan (quando carregando volta a false)
  useEffect(() => { if (!carregando) inputRef.current?.focus() }, [carregando])

  // Carrega placa solicitada pela aba de consulta
  useEffect(() => {
    if (editarPlacaId) {
      carregarPlaca(editarPlacaId)
      onEditarDone?.()
    }
  }, [editarPlacaId])

  const isEditable = !!placa && (!placa.status_placa || placa.status_placa === 'aberta' || placa.local)

  // ---- Contadores ----
  const totalAmostras = grid.filter(w => w.tipo_conteudo === TIPO.AMOSTRA && w.amostra_codigo).length
  const totalCN = grid.filter(w => w.tipo_conteudo === TIPO.CN).length
  const totalCP = grid.filter(w => w.tipo_conteudo === TIPO.CP).length
  const totalReacoes = totalAmostras + totalCN + totalCP
  const hasControls = totalCN > 0 && totalCP > 0

  const nextEmpty = useCallback((afterGridIdx) => {
    const startFP = FILL_POS[afterGridIdx] + 1
    for (let fp = startFP; fp < FILL_ORDER.length; fp++) {
      if (grid[FILL_ORDER[fp]].tipo_conteudo === TIPO.VAZIO) return FILL_ORDER[fp]
    }
    return -1
  }, [grid])

  const firstEmpty = useCallback(() => {
    for (let fp = 0; fp < FILL_ORDER.length; fp++) {
      if (grid[FILL_ORDER[fp]].tipo_conteudo === TIPO.VAZIO) return FILL_ORDER[fp]
    }
    return -1
  }, [grid])

  // ---- Carregar lista de placas ----
  async function fetchPlacas(search = searchPlacas, statusFilter = statusFilterPlacas) {
    setLoadingList(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.append('search', search.trim())
      if (statusFilter) params.append('status_placa', statusFilter)
      const qs = params.toString() ? `?${params.toString()}` : ''
      const data = await api(`/api/placas/${qs}`, { csrfToken })
      setPlacas(data.results || data)
    } catch {
      setPlacas([])
    } finally {
      setLoadingList(false)
    }
  }

  function toggleList() {
    if (!showList) fetchPlacas()
    setShowList(!showList)
  }

  function handleSearchPlacas(e) {
    const val = e.target.value
    setSearchPlacas(val)
    fetchPlacas(val, statusFilterPlacas)
  }

  function handleStatusFilterPlacas(e) {
    const val = e.target.value
    setStatusFilterPlacas(val)
    fetchPlacas(searchPlacas, val)
  }

  // ---- Carregar placa existente ----
  async function carregarPlaca(id) {
    setCarregando(true)
    setFeedback(null)
    try {
      const data = await api(`/api/placas/${id}/`, { csrfToken })
      setPlaca(data)
      if (data.pocos && data.pocos.length > 0) {
        setGrid(gridFromPocos(data.pocos))
        setSalva(true)
      } else {
        setGrid(emptyGrid())
        setSalva(false)
      }
      setSelected(FILL_ORDER[0])
      setShowList(false)
      setFeedback({ tipo: 'sucesso', msg: `Placa ${data.codigo} carregada.` })
    } catch (err) {
      setFeedback({ tipo: 'erro', msg: err.data?.detail || 'Erro ao carregar placa.' })
    } finally {
      setCarregando(false)
    }
  }

  // ---- Criar placa (local — só persiste ao salvar) ----
  function criarPlaca() {
    setPlaca({ local: true })
    setGrid(emptyGrid())
    setSelected(FILL_ORDER[0])
    setSalva(false)
    setFeedback(null)
    setShowList(false)
  }

  // ---- Colocar amostra ----
  function placeSample(amostra, gridIdx) {
    setGrid(prev => {
      const next = [...prev]
      next[gridIdx] = {
        ...next[gridIdx],
        tipo_conteudo: TIPO.AMOSTRA,
        amostra_id: amostra.id,
        amostra_codigo: amostra.codigo_interno,
      }
      return next
    })
    const ne = nextEmpty(gridIdx)
    setSelected(ne === -1 ? gridIdx : ne)
    setFeedback({ tipo: 'sucesso', msg: `${amostra.codigo_interno} → ${ALL_POSITIONS[gridIdx]}` })
    setSalva(false)
    setPendingDuplicate(null)
  }

  // ---- Scan / digitar amostra ----
  async function handleScan(e) {
    e.preventDefault()
    const val = codigo.trim()
    if (!val) return

    if (modo !== TIPO.AMOSTRA) {
      placeControl(modo)
      setCodigo('')
      return
    }

    setCarregando(true)
    setFeedback(null)
    setPendingDuplicate(null)
    try {
      const amostra = await api(`/api/placas/buscar-amostra/?codigo=${encodeURIComponent(val)}`, { csrfToken })

      let idx = selected
      if (grid[idx].tipo_conteudo !== TIPO.VAZIO) idx = firstEmpty()
      if (idx === -1) {
        setFeedback({ tipo: 'aviso', msg: 'Placa cheia.' })
        setCodigo('')
        setCarregando(false)
        return
      }

      if (grid.some(w => w.amostra_codigo === amostra.codigo_interno)) {
        setPendingDuplicate({ amostra, idx })
        setFeedback({ tipo: 'aviso', msg: `${amostra.codigo_interno} já está nesta placa.` })
        setCodigo('')
        setCarregando(false)
        return
      }

      placeSample(amostra, idx)
    } catch (err) {
      setFeedback({ tipo: 'erro', msg: err.data?.erro || 'Amostra não encontrada.' })
    } finally {
      setCodigo('')
      setCarregando(false)
    }
  }

  function forceAddDuplicate() {
    if (!pendingDuplicate) return
    placeSample(pendingDuplicate.amostra, pendingDuplicate.idx)
  }

  function placeControl(tipo) {
    let idx = selected
    if (grid[idx].tipo_conteudo !== TIPO.VAZIO) idx = firstEmpty()
    if (idx === -1) return

    setGrid(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], tipo_conteudo: tipo, amostra_id: null, amostra_codigo: '' }
      return next
    })
    const ne = nextEmpty(idx)
    setSelected(ne === -1 ? idx : ne)
    setSalva(false)
  }

  function clearWell(idx) {
    if (!isEditable) return
    setGrid(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], tipo_conteudo: TIPO.VAZIO, amostra_id: null, amostra_codigo: '' }
      return next
    })
    setSalva(false)
  }

  // ---- Salvar placa ----
  async function salvarPlaca() {
    if (!placa) return
    if (!hasControls) {
      setFeedback({ tipo: 'erro', msg: 'A placa precisa ter pelo menos um CN e um CP.' })
      return
    }
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
      let placaAtual = placa
      if (placa.local) {
        placaAtual = await api('/api/placas/', { csrfToken, method: 'POST', body: {} })
        setPlaca(placaAtual)
      }

      const data = await api(`/api/placas/${placaAtual.id}/salvar-pocos/`, {
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

  // ---- Salvar como nova placa (cópia / repetição) ----
  async function salvarComoNova() {
    if (!hasControls) {
      setFeedback({ tipo: 'erro', msg: 'A placa precisa ter pelo menos um CN e um CP.' })
      return
    }
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
      const novaPlaca = await api('/api/placas/', { csrfToken, method: 'POST', body: {} })
      const data = await api(`/api/placas/${novaPlaca.id}/salvar-pocos/`, {
        csrfToken, method: 'POST', body: { pocos },
      })
      setPlaca(data)
      setSalva(true)
      setFeedback({ tipo: 'sucesso', msg: `Nova placa ${data.codigo} criada com ${totalAmostras} amostra${totalAmostras !== 1 ? 's' : ''}.` })
    } catch (err) {
      const erros = err.data?.erros || err.data?.detail
      setFeedback({ tipo: 'erro', msg: Array.isArray(erros) ? erros.join('; ') : (erros || 'Erro ao criar nova placa.') })
    } finally {
      setCarregando(false)
    }
  }

  // ---- Excluir placa ----
  async function excluirPlaca() {
    if (!placa) return
    if (placa.local) { resetar(); return }
    if (!window.confirm(`Excluir placa ${placa.codigo}? As amostras voltarão ao status Aliquotada.`)) return
    setCarregando(true)
    setFeedback(null)
    try {
      await api(`/api/placas/${placa.id}/`, { csrfToken, method: 'DELETE' })
      setFeedback({ tipo: 'sucesso', msg: `Placa ${placa.codigo} excluída.` })
      resetar()
    } catch (err) {
      setFeedback({ tipo: 'erro', msg: err.data?.erro || err.data?.detail || 'Erro ao excluir.' })
    } finally {
      setCarregando(false)
    }
  }

  function resetar() {
    setPlaca(null)
    setGrid(emptyGrid())
    setSelected(FILL_ORDER[0])
    setFeedback(null)
    setSalva(false)
    setCodigo('')
    setPendingDuplicate(null)
  }

  // ================================================================
  // Render
  // ================================================================
  return (
    <div style={{ fontFamily: 'inherit' }}>

      {/* ---- Selecionar / Criar placa ---- */}
      {!placa && (
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
            Crie uma nova placa ou abra uma existente para editar.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button onClick={criarPlaca} disabled={carregando} style={btnStyle('#1a3a5c')}>
              {carregando ? 'Criando...' : 'Criar Nova Placa'}
            </button>
            <button onClick={toggleList} disabled={carregando} style={btnStyle('#4b5563')}>
              {showList ? 'Fechar Lista' : 'Abrir Placa Existente'}
            </button>
          </div>

          {/* ---- Lista de placas (apenas ABERTA) ---- */}
          {showList && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflowX: 'auto' }}>
              <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={searchPlacas}
                  onChange={handleSearchPlacas}
                  placeholder="Buscar por código (ex: PL2603)"
                  style={{
                    flex: 1, minWidth: 200, padding: '0.45rem 0.75rem',
                    border: '1px solid #d1d5db', borderRadius: 5, fontSize: '0.85rem',
                  }}
                />
                <select
                  value={statusFilterPlacas}
                  onChange={handleStatusFilterPlacas}
                  style={{
                    padding: '0.45rem 0.75rem', border: '1px solid #d1d5db',
                    borderRadius: 5, fontSize: '0.85rem', background: '#fff',
                  }}
                >
                  <option value="">Todos os status</option>
                  <option value="aberta">Aberta</option>
                  <option value="extracao_confirmada">Extração confirmada</option>
                  <option value="submetida">Submetida</option>
                  <option value="resultados_importados">Resultados</option>
                </select>
              </div>
              {loadingList ? (
                <p style={{ padding: '1rem', color: '#6b7280' }}>Carregando...</p>
              ) : placas.length === 0 ? (
                <p style={{ padding: '1rem', color: '#9ca3af' }}>Nenhuma placa encontrada.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                      <th style={thStyle}>Código</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Amostras</th>
                      <th style={thStyle}>Responsável</th>
                      <th style={thStyle}>Data</th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {placas.map(p => {
                      const badge = STATUS_PLACA[p.status_placa] || { bg: '#6c757d', label: p.status_display }
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{p.codigo}</td>
                          <td style={tdStyle}>
                            <span style={{
                              background: badge.bg, color: '#fff',
                              padding: '2px 8px', borderRadius: 4,
                              fontSize: '0.78rem', fontWeight: 500,
                            }}>
                              {badge.label}
                            </span>
                          </td>
                          <td style={tdStyle}>{p.total_amostras}</td>
                          <td style={tdStyle}>{p.responsavel_nome || '—'}</td>
                          <td style={tdStyle}>{fmtDate(p.data_criacao)}</td>
                          <td style={tdStyle}>
                            <button
                              onClick={() => carregarPlaca(p.id)}
                              style={{ ...btnStyle('#1a3a5c'), padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                            >
                              Abrir
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---- Info da placa ativa ---- */}
      {placa && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          marginBottom: '1rem', flexWrap: 'wrap',
        }}>
          <span style={{
            background: '#1a3a5c', color: '#fff', padding: '0.4rem 1rem',
            borderRadius: 6, fontWeight: 600, fontSize: '1rem', letterSpacing: 1,
          }}>
            {placa.local ? 'Nova Placa' : placa.codigo}
          </span>
          <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
            {totalAmostras} amostras | {totalCN} CN | {totalCP} CP | {totalReacoes} reações
          </span>
          {salva && <span style={{ color: '#065f46', fontWeight: 500, fontSize: '0.85rem' }}>Salva</span>}
          {placa.status_placa && placa.status_placa !== 'aberta' && (
            <span style={{
              background: (STATUS_PLACA[placa.status_placa] || {}).bg || '#6c757d',
              color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 500,
            }}>
              {(STATUS_PLACA[placa.status_placa] || {}).label || placa.status_display}
            </span>
          )}
        </div>
      )}

      {/* ---- Feedback ---- */}
      {feedback && (
        <div style={{
          padding: '0.6rem 1rem', borderRadius: 6, marginBottom: '1rem',
          ...feedbackStyles[feedback.tipo],
          display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
        }}>
          <span>{feedback.msg}</span>
          {pendingDuplicate && (
            <button
              onClick={forceAddDuplicate}
              style={{ ...btnStyle('#92400e'), padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
            >
              Adicionar mesmo assim
            </button>
          )}
        </div>
      )}

      {/* ---- Aviso de controles ---- */}
      {placa && isEditable && !hasControls && (
        <div style={{
          padding: '0.5rem 1rem', borderRadius: 6, marginBottom: '1rem',
          background: '#fee2e2', color: '#b91c1c', fontSize: '0.85rem',
          border: '1px solid #fca5a5',
        }}>
          A placa precisa de pelo menos um CN e um CP para ser salva.
        </div>
      )}

      {placa && (
        <>
          {/* ---- Scanner + modo (só para placa aberta) ---- */}
          {isEditable && (
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
          )}

          {/* ---- Reagentes ---- */}
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
                      const isSelected = idx === selected && isEditable

                      return (
                        <td key={col} style={{ padding: 1.5 }}>
                          <div
                            onClick={() => {
                              if (!isEditable) return
                              if (w.tipo_conteudo === TIPO.VAZIO) {
                                if (modo !== TIPO.AMOSTRA) placeControl(modo)
                                else setSelected(idx)
                              } else {
                                setSelected(idx)
                              }
                            }}
                            onContextMenu={(e) => { e.preventDefault(); clearWell(idx) }}
                            title={w.amostra_codigo || w.tipo_conteudo}
                            style={{
                              width: 62, height: 40,
                              background: colors.bg,
                              border: `2px solid ${isSelected ? '#1a3a5c' : colors.border}`,
                              borderRadius: 4,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: isEditable ? 'pointer' : 'default',
                              fontSize: '0.7rem', lineHeight: 1.2,
                              position: 'relative',
                              boxShadow: isSelected ? '0 0 0 2px #3b82f6' : 'none',
                            }}
                          >
                            {w.tipo_conteudo === TIPO.AMOSTRA && w.amostra_codigo && (
                              <span style={{ fontWeight: 700, color: colors.text, fontSize: '0.7rem' }}>
                                {w.amostra_codigo}
                              </span>
                            )}
                            {w.tipo_conteudo === TIPO.CN && <span style={{ fontWeight: 700, color: colors.text }}>CN</span>}
                            {w.tipo_conteudo === TIPO.CP && <span style={{ fontWeight: 700, color: colors.text }}>CP</span>}
                            {w.tipo_conteudo !== TIPO.VAZIO && isEditable && (
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
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            {isEditable && (
              <button
                onClick={salvarPlaca}
                disabled={carregando || totalAmostras === 0 || !hasControls}
                style={{ ...btnStyle('#065f46'), opacity: (carregando || totalAmostras === 0 || !hasControls) ? 0.5 : 1 }}
              >
                {carregando ? 'Salvando...' : 'Salvar Placa'}
              </button>
            )}
            {placa && !placa.local && (
              <button
                onClick={salvarComoNova}
                disabled={carregando || totalAmostras === 0 || !hasControls}
                title="Cria uma nova placa com os mesmos poços, sem alterar a original"
                style={{ ...btnStyle('#1a3a5c'), opacity: (carregando || totalAmostras === 0 || !hasControls) ? 0.5 : 1 }}
              >
                {carregando ? 'Salvando...' : 'Salvar como nova placa'}
              </button>
            )}
            {placa && (
              <button
                onClick={excluirPlaca}
                disabled={carregando}
                style={{ ...btnStyle('#dc3545'), opacity: carregando ? 0.5 : 1 }}
              >
                Excluir Placa
              </button>
            )}
            {salva && placa && (
              <a
                href={`/api/placas/${placa.id}/pdf/`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...btnStyle('#4b5563'), textDecoration: 'none', display: 'inline-block' }}
              >
                Exportar PDF
              </a>
            )}
            <button onClick={resetar} style={btnStyle('#6b7280')}>
              {placa ? 'Fechar Placa' : 'Nova Placa'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ---- Helpers / Styles ----
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const btnStyle = (bg) => ({
  background: bg, color: '#fff', border: 'none', padding: '0.6rem 1.25rem',
  borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
})

const thStyle = {
  padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600,
  color: '#374151', whiteSpace: 'nowrap',
}

const tdStyle = { padding: '0.5rem 0.75rem', color: '#374151' }

const feedbackStyles = {
  sucesso: { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' },
  aviso:   { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
  erro:    { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' },
}
