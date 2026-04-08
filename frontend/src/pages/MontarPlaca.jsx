import { useState, useRef, useCallback, useEffect } from 'react'
import CrachaModal from '../components/CrachaModal'
import NavigationButtons from '../components/NavigationButtons'
import { getOperadorInicial } from '../utils/auth'
import apiFetch from '../utils/apiFetch'

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

// Cores fixas para CN/CP e vazio
const CTRL_COLORS = {
  [TIPO.CN]:    { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  [TIPO.CP]:    { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
  [TIPO.VAZIO]: { bg: '#f9fafb', border: '#e5e7eb', text: '#9ca3af' },
}

// Cores de amostras por grupo (índice 0 = grupo 1)
const GROUP_COLORS = [
  { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },  // grupo 1 — azul
  { bg: '#d1fae5', border: '#10b981', text: '#065f46' },  // grupo 2 — verde
  { bg: '#fde8d8', border: '#f97316', text: '#9a3412' },  // grupo 3 — laranja
  { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6' },  // grupo 4 — roxo
  { bg: '#fce7f3', border: '#db2777', text: '#9d174d' },  // grupo 5 — rosa
]

function wellColors(w) {
  if (w.tipo_conteudo === TIPO.AMOSTRA) {
    return GROUP_COLORS[(w.grupo - 1) % GROUP_COLORS.length]
  }
  return CTRL_COLORS[w.tipo_conteudo] || CTRL_COLORS[TIPO.VAZIO]
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
    grupo: 1,
  }))
  g[DEFAULT_CP_IDX] = { ...g[DEFAULT_CP_IDX], tipo_conteudo: TIPO.CP, grupo: 1 }
  g[DEFAULT_CN_IDX] = { ...g[DEFAULT_CN_IDX], tipo_conteudo: TIPO.CN, grupo: 1 }
  return g
}

function gridFromPocos(pocos) {
  const g = ALL_POSITIONS.map(pos => ({
    posicao: pos,
    tipo_conteudo: TIPO.VAZIO,
    amostra_id: null,
    amostra_codigo: '',
    grupo: 1,
  }))
  for (const poco of pocos) {
    const idx = ALL_POSITIONS.indexOf(poco.posicao)
    if (idx === -1) continue
    g[idx] = {
      posicao: poco.posicao,
      tipo_conteudo: poco.tipo_conteudo,
      amostra_id: poco.amostra || null,
      amostra_codigo: poco.amostra_codigo || '',
      grupo: poco.grupo || 1,
    }
  }
  return g
}

const api = (url, { csrfToken: _csrf, ...opts } = {}) => apiFetch(url, opts)

// ================================================================
export default function MontarPlaca({ csrfToken, editarPlacaId = null, onEditarDone }) {
  // ---- State: operador (crachá ou admin) ----
  const [operador, setOperador] = useState(() => getOperadorInicial())



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
  const [grupoAtivo, setGrupoAtivo] = useState(1)
  const [totalGrupos, setTotalGrupos] = useState(1)
  const [selectedSet, setSelectedSet] = useState(new Set())
  const inputRef = useRef()
  const dragSource = useRef(null)
  const isDraggingSelection = useRef(false)
  const lastClicked = useRef(null)
  const [dragOver, setDragOver] = useState(null)

  // Foco automático no input após cada scan (quando carregando volta a false)
  useEffect(() => { if (!carregando) inputRef.current?.focus() }, [carregando])

  // Delete → limpa poços selecionados (ignora quando foco está num input)
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key !== 'Delete') return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (selectedSet.size > 0) { e.preventDefault(); clearSelected() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedSet])

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

  // Contadores por grupo (para exibir reagentes por grupo)
  const gruposAtivos = [...new Set(grid.filter(w => w.tipo_conteudo !== TIPO.VAZIO).map(w => w.grupo))].sort()
  function reacoesPorGrupo(g) {
    return grid.filter(w => w.tipo_conteudo !== TIPO.VAZIO && w.grupo === g).length
  }

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
        const grupos = [...new Set(data.pocos.map(p => p.grupo || 1))].sort()
        const maxGrupo = grupos.length > 0 ? Math.max(...grupos) : 1
        setTotalGrupos(maxGrupo)
        setGrupoAtivo(1)
      } else {
        setGrid(emptyGrid())
        setSalva(false)
        setTotalGrupos(1)
        setGrupoAtivo(1)
      }
      setSelected(FILL_ORDER[0])
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
    setGrupoAtivo(1)
    setTotalGrupos(1)
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
        grupo: grupoAtivo,
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
      next[idx] = { ...next[idx], tipo_conteudo: tipo, amostra_id: null, amostra_codigo: '', grupo: grupoAtivo }
      return next
    })
    const ne = nextEmpty(idx)
    setSelected(ne === -1 ? idx : ne)
    setSalva(false)
  }

  // ---- Adicionar novo grupo com controles automáticos ----
  function adicionarGrupo() {
    const novoGrupo = totalGrupos + 1

    // Encontra os controles do grupo 1 como referência
    const cpGrupo1 = grid.find(w => w.tipo_conteudo === TIPO.CP && w.grupo === 1)
    const cnGrupo1 = grid.find(w => w.tipo_conteudo === TIPO.CN && w.grupo === 1)

    if (!cpGrupo1 || !cnGrupo1) {
      setFeedback({ tipo: 'erro', msg: 'Defina os controles CP e CN do Grupo 1 antes de adicionar um novo grupo.' })
      return
    }

    // Calcula posições dos controles do novo grupo (desloca coluna para esquerda)
    const offset = novoGrupo - 1
    function deslocarPosicao(posicao) {
      const row = posicao[0]
      const col = parseInt(posicao.slice(1), 10)
      const newCol = col - offset
      if (newCol < 1) return null
      return `${row}${String(newCol).padStart(2, '0')}`
    }

    const novaCpPos = deslocarPosicao(cpGrupo1.posicao)
    const novaCnPos = deslocarPosicao(cnGrupo1.posicao)

    if (!novaCpPos || !novaCnPos) {
      setFeedback({ tipo: 'erro', msg: `Não há espaço para os controles do Grupo ${novoGrupo} (coluna fora da placa).` })
      return
    }

    const cpIdx = ALL_POSITIONS.indexOf(novaCpPos)
    const cnIdx = ALL_POSITIONS.indexOf(novaCnPos)

    // Verifica colisão
    const colisoes = []
    if (grid[cpIdx]?.tipo_conteudo !== TIPO.VAZIO) colisoes.push(`CP em ${novaCpPos}`)
    if (grid[cnIdx]?.tipo_conteudo !== TIPO.VAZIO) colisoes.push(`CN em ${novaCnPos}`)
    if (colisoes.length > 0) {
      setFeedback({
        tipo: 'erro',
        msg: `Não foi possível inserir controles do Grupo ${novoGrupo}: poço(s) ocupado(s) — ${colisoes.join(', ')}. Libere os poços e tente novamente.`,
      })
      return
    }

    setGrid(prev => {
      const next = [...prev]
      next[cpIdx] = { ...next[cpIdx], tipo_conteudo: TIPO.CP, amostra_id: null, amostra_codigo: '', grupo: novoGrupo }
      next[cnIdx] = { ...next[cnIdx], tipo_conteudo: TIPO.CN, amostra_id: null, amostra_codigo: '', grupo: novoGrupo }
      return next
    })
    setTotalGrupos(novoGrupo)
    setGrupoAtivo(novoGrupo)
    setSalva(false)
    setFeedback({ tipo: 'sucesso', msg: `Grupo ${novoGrupo} criado. CP em ${novaCpPos}, CN em ${novaCnPos}.` })
  }

  // ---- Remover grupo (limpa todos os poços do grupo) ----
  function removerGrupo(grupo) {
    if (grupo === 1) return  // grupo 1 nunca pode ser removido
    setGrid(prev => prev.map(w =>
      w.grupo === grupo
        ? { ...w, tipo_conteudo: TIPO.VAZIO, amostra_id: null, amostra_codigo: '', grupo: 1 }
        : w
    ))
    // Recalcula totalGrupos com base no que sobrou
    setTotalGrupos(prev => {
      const novo = prev === grupo ? grupo - 1 : prev
      return novo
    })
    if (grupoAtivo === grupo) setGrupoAtivo(grupo - 1)
    setSalva(false)
    setFeedback({ tipo: 'aviso', msg: `Grupo ${grupo} removido.` })
  }

  function moverParaGrupo(grupo) {
    const targets = selectedSet.size > 0
      ? [...selectedSet].filter(i => grid[i].tipo_conteudo !== TIPO.VAZIO)
      : (grid[selected]?.tipo_conteudo !== TIPO.VAZIO ? [selected] : [])
    if (targets.length === 0) return
    setGrid(prev => {
      const next = [...prev]
      targets.forEach(i => { next[i] = { ...next[i], grupo } })
      return next
    })
    setSalva(false)
    setFeedback({ tipo: 'sucesso', msg: `${targets.length} poço(s) movidos para Grupo ${grupo}.` })
  }

  function clearWell(idx) {
    if (!isEditable) return
    setGrid(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], tipo_conteudo: TIPO.VAZIO, amostra_id: null, amostra_codigo: '' }
      return next
    })
    setSelectedSet(prev => { const s = new Set(prev); s.delete(idx); return s })
    setSalva(false)
  }

  function clearSelected() {
    if (!isEditable || selectedSet.size === 0) return
    const filled = [...selectedSet].filter(i => grid[i].tipo_conteudo !== TIPO.VAZIO)
    if (filled.length === 0) return
    setGrid(prev => {
      const next = [...prev]
      filled.forEach(i => {
        next[i] = { ...next[i], tipo_conteudo: TIPO.VAZIO, amostra_id: null, amostra_codigo: '' }
      })
      return next
    })
    setSelectedSet(new Set())
    setSalva(false)
    setFeedback({ tipo: 'aviso', msg: `${filled.length} poço(s) limpo(s).` })
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
        grupo: w.grupo || 1,
      }))

    try {
      let placaAtual = placa
      if (placa.local) {
        placaAtual = await api('/api/placas/', { csrfToken, method: 'POST', body: {} })
        setPlaca(placaAtual)
      }

      const data = await api(`/api/placas/${placaAtual.id}/salvar-pocos/`, {
        csrfToken, method: 'POST', body: { pocos, numero_cracha: operador?.numero_cracha },
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
        grupo: w.grupo || 1,
      }))

    try {
      const novaPlaca = await api('/api/placas/', { csrfToken, method: 'POST', body: {} })
      const data = await api(`/api/placas/${novaPlaca.id}/salvar-pocos/`, {
        csrfToken, method: 'POST', body: { pocos, numero_cracha: operador?.numero_cracha },
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
    setGrupoAtivo(1)
    setTotalGrupos(1)
  }

  // ================================================================
  // Render
  // ================================================================
  return (
    <div style={{ fontFamily: 'inherit' }}>
      <NavigationButtons currentStep="extracao" />

      {/* Modal bloqueante de identificação */}
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="Extração — Montar Placa" />
      )}

      {/* Barra do operador */}
      {operador && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: '#f0fdf4', border: '1px solid #6ee7b7', borderRadius: 8,
          padding: '0.6rem 1rem', marginBottom: '1rem',
        }}>
          <span style={{ fontSize: '0.9rem', color: '#065f46', fontWeight: 600 }}>
            Operador: {operador.nome_completo}
          </span>
          <span style={{
            fontSize: '0.72rem', background: '#d1fae5', color: '#065f46',
            padding: '1px 6px', borderRadius: 10, fontWeight: 500,
          }}>
            {operador.perfil}
          </span>
          <button
            onClick={() => setOperador(null)}
            style={{
              marginLeft: 'auto', background: 'none', border: '1px solid #6ee7b7',
              borderRadius: 6, padding: '0.3rem 0.75rem', fontSize: '0.78rem',
              color: '#065f46', cursor: 'pointer', fontWeight: 500,
            }}
          >
            Trocar operador
          </button>
        </div>
      )}

      {/* ---- Selecionar / Criar placa ---- */}
      {!placa && (
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
            Crie uma nova placa ou use a aba "Consultar Placas" para abrir uma existente.
          </p>
          <button onClick={criarPlaca} disabled={carregando} style={btnStyle('#1a3a5c')}>
            {carregando ? 'Criando...' : 'Criar Nova Placa'}
          </button>
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
                {[TIPO.AMOSTRA, TIPO.CN, TIPO.CP].map(t => {
                  const modeColor = t === TIPO.AMOSTRA
                    ? GROUP_COLORS[0].border
                    : (CTRL_COLORS[t]?.border || '#d1d5db')
                  return (
                  <button
                    key={t}
                    onClick={() => setModo(t)}
                    style={{
                      ...btnStyle(modo === t ? modeColor : '#d1d5db'),
                      color: modo === t ? '#fff' : '#374151',
                      padding: '0.5rem 0.75rem', fontSize: '0.8rem',
                    }}
                  >
                    {t === TIPO.AMOSTRA ? 'Amostra' : t.toUpperCase()}
                  </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ---- Barra de grupos ---- */}
          {isEditable && (
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {Array.from({ length: totalGrupos }, (_, i) => i + 1).map(g => {
                const gc = GROUP_COLORS[(g - 1) % GROUP_COLORS.length]
                const isAtivo = g === grupoAtivo
                return (
                  <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    <button
                      onClick={() => setGrupoAtivo(g)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        background: isAtivo ? gc.border : '#f9fafb',
                        color: isAtivo ? '#fff' : gc.text,
                        border: `2px solid ${gc.border}`,
                        borderRadius: g === totalGrupos && totalGrupos > 1 ? '6px 0 0 6px' : 6,
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        fontWeight: isAtivo ? 700 : 500,
                      }}
                    >
                      Grupo {g}
                    </button>
                    {g > 1 && (
                      <button
                        onClick={() => removerGrupo(g)}
                        title={`Remover Grupo ${g}`}
                        style={{
                          padding: '0.35rem 0.4rem',
                          background: isAtivo ? gc.border : '#f9fafb',
                          color: isAtivo ? '#fff' : '#9ca3af',
                          border: `2px solid ${gc.border}`,
                          borderLeft: 'none',
                          borderRadius: '0 6px 6px 0',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
              {totalGrupos < GROUP_COLORS.length && (
                <button
                  onClick={adicionarGrupo}
                  style={{
                    padding: '0.35rem 0.75rem',
                    background: '#fff',
                    color: '#374151',
                    border: '2px dashed #d1d5db',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                  }}
                >
                  + Adicionar Grupo
                </button>
              )}
              {/* Mover seleção/cursor para outro grupo */}
              {totalGrupos > 1 && (selectedSet.size > 0 || grid[selected]?.tipo_conteudo !== TIPO.VAZIO) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem', paddingLeft: '0.75rem', borderLeft: '2px solid #e5e7eb' }}>
                  <span style={{ fontSize: '0.78rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {selectedSet.size > 1 ? `Mover ${selectedSet.size} selecionados →` : 'Mover para →'}
                  </span>
                  {Array.from({ length: totalGrupos }, (_, i) => i + 1).map(g => {
                    const gc = GROUP_COLORS[(g - 1) % GROUP_COLORS.length]
                    return (
                      <button
                        key={g}
                        onClick={() => moverParaGrupo(g)}
                        title={`Mover para Grupo ${g}`}
                        style={{
                          padding: '0.25rem 0.6rem',
                          background: gc.bg,
                          color: gc.text,
                          border: `2px solid ${gc.border}`,
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                        }}
                      >
                        G{g}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---- Reagentes por grupo ---- */}
          {totalReacoes > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              {(gruposAtivos.length > 0 ? gruposAtivos : [1]).map(g => {
                const rg = reacoesPorGrupo(g)
                const gc = GROUP_COLORS[(g - 1) % GROUP_COLORS.length]
                return (
                  <div key={g} style={{
                    display: 'flex', gap: '1.5rem', padding: '0.5rem 1rem',
                    background: gc.bg, borderRadius: 6, fontSize: '0.85rem', color: gc.text,
                    flexWrap: 'wrap', marginBottom: '0.35rem',
                    border: `1px solid ${gc.border}`,
                  }}>
                    {gruposAtivos.length > 1 && (
                      <span style={{ fontWeight: 700, minWidth: 60 }}>Grupo {g}:</span>
                    )}
                    {REAGENTES.map(r => (
                      <span key={r.nome}>
                        <b>{r.nome}:</b> {(rg * r.vol).toFixed(1)} uL ({r.vol} × {rg})
                      </span>
                    ))}
                  </div>
                )
              })}
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
                      const colors = wellColors(w)
                      const isDragOver = dragOver === idx
                      const isDragSource = dragSource.current === idx
                      const isInSelection = selectedSet.has(idx)
                      const isCursor = idx === selected && isEditable && selectedSet.size === 0

                      return (
                        <td key={col} style={{ padding: 1.5 }}>
                          <div
                            draggable={isEditable && w.tipo_conteudo !== TIPO.VAZIO}
                            onDragStart={() => {
                              dragSource.current = idx
                              isDraggingSelection.current = selectedSet.has(idx) && selectedSet.size > 1
                            }}
                            onDragEnd={() => { dragSource.current = null; isDraggingSelection.current = false; setDragOver(null) }}
                            onDragOver={(e) => { if (!isEditable) return; e.preventDefault(); setDragOver(idx) }}
                            onDragLeave={() => setDragOver(null)}
                            onDrop={(e) => {
                              e.preventDefault()
                              const src = dragSource.current
                              if (src === null || src === idx) { setDragOver(null); return }
                              if (isDraggingSelection.current) {
                                const rowOff = Math.floor(idx / 12) - Math.floor(src / 12)
                                const colOff = (idx % 12) - (src % 12)
                                const moves = []
                                for (const si of selectedSet) {
                                  const toRow = Math.floor(si / 12) + rowOff
                                  const toCol = (si % 12) + colOff
                                  if (toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 12) {
                                    setFeedback({ tipo: 'aviso', msg: 'Movimento fora dos limites da placa.' })
                                    setDragOver(null); return
                                  }
                                  const toIdx = toRow * 12 + toCol
                                  if (grid[toIdx].tipo_conteudo !== TIPO.VAZIO && !selectedSet.has(toIdx)) {
                                    setFeedback({ tipo: 'aviso', msg: 'Posição de destino ocupada.' })
                                    setDragOver(null); return
                                  }
                                  moves.push({ from: si, to: toIdx })
                                }
                                setGrid(prev => {
                                  const next = [...prev]
                                  const moving = moves.map(({ from }) => ({ ...prev[from] }))
                                  moves.forEach(({ from }) => {
                                    next[from] = { ...next[from], tipo_conteudo: TIPO.VAZIO, amostra_id: null, amostra_codigo: '' }
                                  })
                                  moves.forEach(({ to }, i) => {
                                    next[to] = { ...moving[i], posicao: next[to].posicao }
                                  })
                                  return next
                                })
                                setSelectedSet(new Set(moves.map(({ to }) => to)))
                              } else {
                                setGrid(prev => {
                                  const next = [...prev]
                                  const srcPos = next[src].posicao
                                  const dstPos = next[idx].posicao
                                  next[src] = { ...next[idx], posicao: srcPos }
                                  next[idx] = { ...prev[src], posicao: dstPos }
                                  return next
                                })
                                setSelectedSet(new Set())
                              }
                              setSalva(false)
                              dragSource.current = null
                              isDraggingSelection.current = false
                              setDragOver(null)
                            }}
                            onClick={(e) => {
                              if (!isEditable) return
                              if (e.ctrlKey || e.metaKey) {
                                // Ctrl+click: adiciona/remove da seleção
                                setSelectedSet(prev => {
                                  const next = new Set(prev)
                                  if (next.has(idx)) next.delete(idx)
                                  else next.add(idx)
                                  return next
                                })
                                lastClicked.current = idx
                              } else if (e.shiftKey && lastClicked.current !== null) {
                                // Shift+click: seleciona intervalo (ordem do grid)
                                const from = Math.min(lastClicked.current, idx)
                                const to = Math.max(lastClicked.current, idx)
                                setSelectedSet(prev => {
                                  const next = new Set(prev)
                                  for (let i = from; i <= to; i++) {
                                    if (grid[i].tipo_conteudo !== TIPO.VAZIO) next.add(i)
                                  }
                                  return next
                                })
                              } else {
                                // Click simples: limpa seleção, comportamento original
                                setSelectedSet(new Set())
                                lastClicked.current = idx
                                if (w.tipo_conteudo === TIPO.VAZIO) {
                                  if (modo !== TIPO.AMOSTRA) placeControl(modo)
                                  else setSelected(idx)
                                } else {
                                  setSelected(idx)
                                }
                              }
                            }}
                            onContextMenu={(e) => { e.preventDefault(); clearWell(idx) }}
                            title={w.amostra_codigo || w.tipo_conteudo}
                            style={{
                              width: 62, height: 40,
                              background: colors.bg,
                              border: `2px solid ${isDragOver ? '#f59e0b' : isInSelection ? '#7c3aed' : isCursor ? '#1a3a5c' : colors.border}`,
                              borderRadius: 4,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: isEditable && w.tipo_conteudo !== TIPO.VAZIO ? 'grab' : isEditable ? 'pointer' : 'default',
                              fontSize: '0.7rem', lineHeight: 1.2,
                              position: 'relative',
                              boxShadow: isDragOver ? '0 0 0 2px #f59e0b' : isInSelection ? '0 0 0 2px #7c3aed' : isCursor ? '0 0 0 2px #3b82f6' : 'none',
                              opacity: isDragSource ? 0.4 : 1,
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
const btnStyle = (bg) => ({
  background: bg, color: '#fff', border: 'none', padding: '0.6rem 1.25rem',
  borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
})

const feedbackStyles = {
  sucesso: { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' },
  aviso:   { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
  erro:    { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' },
}
