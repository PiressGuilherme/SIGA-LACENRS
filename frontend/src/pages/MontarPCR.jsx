import { useState, useRef, useCallback, useEffect } from 'react'
import CrachaModal from '../components/CrachaModal'
import NavigationButtons from '../components/NavigationButtons'
import { getOperadorInicial, isEspecialista } from '../utils/auth'
import apiFetch from '../utils/apiFetch'
import WellGrid from '../components/plates/WellGrid'
import {
  ALL_POSITIONS, FILL_ORDER, FILL_POS, TIPO,
  emptyGrid as baseEmptyGrid, gridFromPocos as baseGridFromPocos,
  btnStyle, feedbackStyles,
} from '../components/plates/PlateConstants'

const TIPO_COLORS = {
  [TIPO.AMOSTRA]: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  [TIPO.CN]:      { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  [TIPO.CP]:      { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
  [TIPO.VAZIO]:   { bg: '#f9fafb', border: '#e5e7eb', text: '#9ca3af' },
}

const REPETIDO_COLORS = { bg: '#fef9c3', border: '#eab308', text: '#713f12' }

const REAGENTES = [
  { nome: 'Master Mix', vol: 15 },
  { nome: 'Primer Mix', vol: 5 },
]

const emptyGrid = () => baseEmptyGrid({ tem_resultado: false })
const gridFromPocos = (pocos) => baseGridFromPocos(pocos, { tem_resultado: false })

const api = (url, { csrfToken: _csrf, ...opts } = {}) => apiFetch(url, opts)

const STATUS_PLACA = {
  aberta:                { bg: '#0d6efd', label: 'Aberta' },
  submetida:             { bg: '#fd7e14', label: 'Submetida' },
  resultados_importados: { bg: '#198754', label: 'Resultados' },
}

// ================================================================
export default function MontarPCR({ csrfToken, editarPlacaId = null, onEditarDone }) {
  // ---- State: operador (crachá ou admin) ----
  const [operador, setOperador] = useState(() => getOperadorInicial())

  // ---- State: escolha de origem ----
  const [modoInicio, setModoInicio] = useState(null)  // null | 'rascunho' | 'zero'
  const [placasExtracao, setPlacasExtracao] = useState([])
  const [loadingExtracoes, setLoadingExtracoes] = useState(false)
  const [placaOrigemId, setPlacaOrigemId] = useState(null)
  const [placaOrigemCodigo, setPlacaOrigemCodigo] = useState('')
  const [carregandoRascunho, setCarregandoRascunho] = useState(false)


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
  // Confirmação para amostra com resultado
  const [pendingComResultado, setPendingComResultado] = useState(null)
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

  // Carrega placa PCR solicitada pela aba de consulta
  useEffect(() => {
    if (editarPlacaId) {
      carregarPlacaPCR(editarPlacaId)
      onEditarDone?.()
    }
  }, [editarPlacaId])

  const isEditable = !!placa && (!placa.status_placa || placa.status_placa === 'aberta' || placa.local)

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

  // ---- Carregar placas de extração confirmada (para rascunho) ----
  async function fetchPlacasExtracao() {
    setLoadingExtracoes(true)
    try {
      const data = await api('/api/placas/?tipo_placa=extracao&status_placa=extracao_confirmada', { csrfToken })
      setPlacasExtracao(data.results || data)
    } catch {
      setPlacasExtracao([])
    } finally {
      setLoadingExtracoes(false)
    }
  }


  // ---- Carregar rascunho de extração ----
  async function carregarRascunho(extId, extCodigo) {
    setCarregandoRascunho(true)
    setFeedback(null)
    try {
      const data = await api(`/api/placas/${extId}/rascunho-pcr/`, { csrfToken })
      setPlaca({ local: true, tipo_placa: 'pcr', placa_origem_id: data.placa_origem_id })
      setPlacaOrigemId(data.placa_origem_id)
      setPlacaOrigemCodigo(data.placa_origem_codigo)
      setGrid(gridFromPocos(data.pocos))
      setSalva(false)
      setModoInicio(null)
      setFeedback({ tipo: 'sucesso', msg: `Rascunho carregado da extração ${extCodigo}. Revise e salve.` })
    } catch (err) {
      setFeedback({ tipo: 'erro', msg: err.data?.erro || 'Erro ao carregar rascunho.' })
    } finally {
      setCarregandoRascunho(false)
    }
  }

  // ---- Carregar placa PCR existente ----
  async function carregarPlacaPCR(id) {
    setCarregando(true)
    setFeedback(null)
    try {
      const data = await api(`/api/placas/${id}/`, { csrfToken })
      setPlaca(data)
      setGrid(data.pocos?.length ? gridFromPocos(data.pocos) : emptyGrid())
      setSalva(true)
      setModoInicio(null)
      setFeedback({ tipo: 'sucesso', msg: `Placa PCR ${data.codigo} carregada.` })
    } catch (err) {
      setFeedback({ tipo: 'erro', msg: err.data?.detail || 'Erro ao carregar placa.' })
    } finally {
      setCarregando(false)
    }
  }

  function iniciarDoZero() {
    setPlaca({ local: true, tipo_placa: 'pcr' })
    setGrid(emptyGrid())
    setSelected(FILL_ORDER[0])
    setSalva(false)
    setFeedback(null)
    setModoInicio(null)
    setPlacaOrigemId(null)
    setPlacaOrigemCodigo('')
  }

  // ---- Colocar amostra ----
  function placeSample(amostra, gridIdx, temResultado = false) {
    setGrid(prev => {
      const next = [...prev]
      next[gridIdx] = {
        ...next[gridIdx],
        tipo_conteudo: TIPO.AMOSTRA,
        amostra_id: amostra.id,
        amostra_codigo: amostra.codigo_interno,
        tem_resultado: temResultado,
      }
      return next
    })
    const ne = nextEmpty(gridIdx)
    setSelected(ne === -1 ? gridIdx : ne)
    setFeedback({
      tipo: 'sucesso',
      msg: `${amostra.codigo_interno} → ${ALL_POSITIONS[gridIdx]}${temResultado ? ' (repetição)' : ''}`,
    })
    setSalva(false)
    setPendingDuplicate(null)
    setPendingComResultado(null)
  }

  // ---- Scan de amostra para PCR ----
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
    setPendingComResultado(null)
    try {
      const amostra = await api(
        `/api/placas/buscar-amostra/?codigo=${encodeURIComponent(val)}&modulo=pcr`,
        { csrfToken }
      )

      let idx = selected
      if (grid[idx].tipo_conteudo !== TIPO.VAZIO) idx = firstEmpty()
      if (idx === -1) {
        setFeedback({ tipo: 'aviso', msg: 'Placa cheia.' })
        setCodigo('')
        setCarregando(false)
        return
      }

      // Verificar duplicata
      if (grid.some(w => w.amostra_codigo === amostra.codigo_interno)) {
        setPendingDuplicate({ amostra, idx, temResultado: amostra.tem_resultado })
        setFeedback({ tipo: 'aviso', msg: `${amostra.codigo_interno} já está nesta placa.` })
        setCodigo('')
        setCarregando(false)
        return
      }

      // Verificar se já tem resultado (pede confirmação)
      if (amostra.tem_resultado) {
        setPendingComResultado({ amostra, idx })
        setFeedback({
          tipo: 'aviso',
          msg: `${amostra.codigo_interno} já possui resultado registrado. Confirma inclusão para repetição?`,
        })
        setCodigo('')
        setCarregando(false)
        return
      }

      placeSample(amostra, idx, false)
    } catch (err) {
      setFeedback({ tipo: 'erro', msg: err.data?.erro || 'Amostra não encontrada.' })
    } finally {
      setCodigo('')
      setCarregando(false)
    }
  }

  function placeControl(tipo) {
    let idx = selected
    if (grid[idx].tipo_conteudo !== TIPO.VAZIO) idx = firstEmpty()
    if (idx === -1) return
    setGrid(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], tipo_conteudo: tipo, amostra_id: null, amostra_codigo: '', tem_resultado: false }
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
      next[idx] = { ...next[idx], tipo_conteudo: TIPO.VAZIO, amostra_id: null, amostra_codigo: '', tem_resultado: false }
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
        next[i] = { ...next[i], tipo_conteudo: TIPO.VAZIO, amostra_id: null, amostra_codigo: '', tem_resultado: false }
      })
      return next
    })
    setSelectedSet(new Set())
    setSalva(false)
    setFeedback({ tipo: 'aviso', msg: `${filled.length} poço(s) limpo(s).` })
  }

  // ---- Salvar placa PCR ----
  async function salvarPlaca() {
    if (!placa || !hasControls) return
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
        placaAtual = await api('/api/placas/', {
          csrfToken, method: 'POST',
          body: {
            tipo_placa: 'pcr',
            placa_origem: placaOrigemId || null,
          },
        })
        setPlaca(placaAtual)
      }

      const data = await api(`/api/placas/${placaAtual.id}/salvar-pocos/`, {
        csrfToken, method: 'POST', body: { pocos, numero_cracha: operador?.numero_cracha },
      })
      setPlaca(data)
      setSalva(true)
      setFeedback({ tipo: 'sucesso', msg: `Placa PCR ${data.codigo} salva — ${totalAmostras} amostras.` })
    } catch (err) {
      const erros = err.data?.erros || err.data?.erro || err.data?.detail
      setFeedback({ tipo: 'erro', msg: Array.isArray(erros) ? erros.join('; ') : (erros || `Erro ao salvar. (HTTP ${err.status})`) })
    } finally {
      setCarregando(false)
    }
  }

  // ---- Enviar ao termociclador ----
  async function submeterTermociclador() {
    if (!placa?.id) return
    if (!window.confirm(`Enviar placa ${placa.codigo} ao termociclador? Esta ação não pode ser desfeita.`)) return
    setCarregando(true)
    setFeedback(null)
    try {
      const data = await api(`/api/placas/${placa.id}/submeter/`, {
        csrfToken, method: 'POST', body: { numero_cracha: operador?.numero_cracha },
      })
      setPlaca(data)
      setFeedback({ tipo: 'sucesso', msg: `Placa ${data.codigo} enviada ao termociclador.` })
    } catch (err) {
      setFeedback({ tipo: 'erro', msg: err.data?.erro || err.data?.detail || 'Erro ao submeter.' })
    } finally {
      setCarregando(false)
    }
  }

  // ---- Salvar como nova placa PCR (cópia / repetição) ----
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
      const novaPlaca = await api('/api/placas/', {
        csrfToken, method: 'POST',
        body: { tipo_placa: 'pcr', placa_origem: placa?.placa_origem || null },
      })
      const data = await api(`/api/placas/${novaPlaca.id}/salvar-pocos/`, {
        csrfToken, method: 'POST', body: { pocos, numero_cracha: operador?.numero_cracha },
      })
      setPlaca(data)
      setSalva(true)
      setFeedback({ tipo: 'sucesso', msg: `Nova placa PCR ${data.codigo} criada com ${totalAmostras} amostra${totalAmostras !== 1 ? 's' : ''}.` })
    } catch (err) {
      const erros = err.data?.erros || err.data?.erro || err.data?.detail
      setFeedback({ tipo: 'erro', msg: Array.isArray(erros) ? erros.join('; ') : (erros || 'Erro ao criar nova placa.') })
    } finally {
      setCarregando(false)
    }
  }

  // ---- Excluir placa PCR ----
  async function excluirPlaca() {
    if (!placa) return
    if (placa.local) { resetar(); return }
    if (!window.confirm(`Excluir placa PCR ${placa.codigo}?`)) return
    setCarregando(true)
    try {
      await api(`/api/placas/${placa.id}/`, { csrfToken, method: 'DELETE' })
      resetar()
    } catch (err) {
      setFeedback({ tipo: 'erro', msg: err.data?.erro || 'Erro ao excluir.' })
      setCarregando(false)
    }
  }

  // ---- Rodar replicata (duplicar placa que falhou) ----
  async function rodarReplicata() {
    if (!placa || placa.local) return
    if (!window.confirm(`Criar replicata da placa ${placa.codigo}? Uma nova placa PCR será criada com os mesmos poços.`)) return
    setCarregando(true)
    setFeedback(null)
    try {
      const data = await api(`/api/placas/${placa.id}/replicata/`, {
        csrfToken, method: 'POST', body: { numero_cracha: operador?.numero_cracha },
      })
      setPlaca(data)
      setGrid(gridFromPocos(data.pocos || []))
      setSalva(true)
      setFeedback({ tipo: 'sucesso', msg: `Replicata criada: placa ${data.codigo}.` })
    } catch (err) {
      setFeedback({ tipo: 'erro', msg: err.data?.erro || 'Erro ao criar replicata.' })
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
    setPendingComResultado(null)
    setModoInicio(null)
    setPlacaOrigemId(null)
    setPlacaOrigemCodigo('')
  }

  // ================================================================
  // Render
  // ================================================================
  return (
    <div style={{ fontFamily: 'inherit' }}>
      <NavigationButtons currentStep="pcr" />

      {/* Modal bloqueante de identificação */}
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="PCR — Montar Placa" />
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

      {/* ---- Tela de escolha de início ---- */}
      {!placa && modoInicio === null && (
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
            Monte uma nova placa de PCR a partir de uma extração ou do zero. Use a aba "Consultar Placas PCR" para abrir uma existente.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button
              onClick={() => { setModoInicio('rascunho'); fetchPlacasExtracao() }}
              style={btnStyle('#1a3a5c')}
            >
              Carregar de Extração
            </button>
            <button onClick={iniciarDoZero} style={btnStyle('#065f46')}>
              Nova Placa
            </button>
          </div>
        </div>
      )}

      {/* ---- Seleção de placa de extração (rascunho) ---- */}
      {!placa && modoInicio === 'rascunho' && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', color: '#1a3a5c', margin: 0 }}>
              Selecionar Placa de Extração
            </h3>
            <button onClick={() => setModoInicio(null)} style={{ ...btnStyle('#6b7280'), padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}>
              Voltar
            </button>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Placas com extração confirmada. Amostras não elegíveis (não extraídas) serão omitidas do rascunho.
          </p>
          {loadingExtracoes ? (
            <p style={{ color: '#6b7280' }}>Carregando extrações...</p>
          ) : placasExtracao.length === 0 ? (
            <p style={{ color: '#9ca3af' }}>Nenhuma placa de extração confirmada encontrada.</p>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={thStyle}>Código</th>
                    <th style={thStyle}>Amostras</th>
                    <th style={thStyle}>Responsável</th>
                    <th style={thStyle}>Data</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {placasExtracao.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{p.codigo}</td>
                      <td style={tdStyle}>{p.total_amostras}</td>
                      <td style={tdStyle}>{p.responsavel_nome || '—'}</td>
                      <td style={tdStyle}>{fmtDate(p.data_criacao)}</td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => carregarRascunho(p.id, p.codigo)}
                          disabled={carregandoRascunho}
                          style={{ ...btnStyle('#1a3a5c'), padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                        >
                          {carregandoRascunho ? '...' : 'Usar como base'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---- Info da placa ativa ---- */}
      {placa && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <span style={{ background: '#065f46', color: '#fff', padding: '0.4rem 1rem', borderRadius: 6, fontWeight: 600, fontSize: '1rem', letterSpacing: 1 }}>
            {placa.local ? 'Nova Placa PCR' : placa.codigo}
          </span>
          {placaOrigemCodigo && (
            <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
              base: <b>{placaOrigemCodigo}</b>
            </span>
          )}
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
          {/* Confirmar amostra com resultado */}
          {pendingComResultado && (
            <button
              onClick={() => placeSample(pendingComResultado.amostra, pendingComResultado.idx, true)}
              style={{ ...btnStyle('#92400e'), padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
            >
              Confirmar repetição
            </button>
          )}
          {/* Confirmar duplicata */}
          {pendingDuplicate && !pendingComResultado && (
            <button
              onClick={() => placeSample(pendingDuplicate.amostra, pendingDuplicate.idx, pendingDuplicate.temResultado)}
              style={{ ...btnStyle('#92400e'), padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
            >
              Adicionar mesmo assim
            </button>
          )}
        </div>
      )}

      {/* ---- Aviso de controles ---- */}
      {placa && isEditable && !hasControls && (
        <div style={{ padding: '0.5rem 1rem', borderRadius: 6, marginBottom: '1rem', background: '#fee2e2', color: '#b91c1c', fontSize: '0.85rem', border: '1px solid #fca5a5' }}>
          A placa precisa de pelo menos um CN e um CP para ser salva.
        </div>
      )}

      {placa && (
        <>
          {/* ---- Scanner + modo ---- */}
          {isEditable && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <form onSubmit={handleScan} style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: 280 }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={codigo}
                  onChange={e => setCodigo(e.target.value)}
                  placeholder={modo === TIPO.AMOSTRA ? 'Escanear código da amostra (extraída)...' : `Enter para ${modo === TIPO.CN ? 'CN' : 'CP'}`}
                  disabled={carregando}
                  autoComplete="off"
                  style={{ flex: 1, padding: '0.6rem 0.75rem', fontSize: '1rem', border: '2px solid #6ee7b7', borderRadius: 6, outline: 'none' }}
                />
                <button type="submit" disabled={carregando} style={btnStyle('#065f46')}>
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

          {/* ---- Legenda ---- */}
          {isEditable && (
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.78rem', color: '#6b7280' }}>
              <span><span style={{ display: 'inline-block', width: 12, height: 12, background: TIPO_COLORS[TIPO.AMOSTRA].bg, border: `1px solid ${TIPO_COLORS[TIPO.AMOSTRA].border}`, borderRadius: 2, marginRight: 4 }}></span>Amostra extraída</span>
              <span><span style={{ display: 'inline-block', width: 12, height: 12, background: REPETIDO_COLORS.bg, border: `1px solid ${REPETIDO_COLORS.border}`, borderRadius: 2, marginRight: 4 }}></span>Repetição (com resultado)</span>
            </div>
          )}

          {/* ---- Reagentes ---- */}
          {totalReacoes > 0 && (
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', padding: '0.6rem 1rem', background: '#f0fdf4', borderRadius: 6, fontSize: '0.85rem', color: '#065f46', flexWrap: 'wrap' }}>
              {REAGENTES.map(r => (
                <span key={r.nome}>
                  <b>{r.nome}:</b> {(totalReacoes * r.vol).toFixed(1)} uL ({r.vol} x {totalReacoes})
                </span>
              ))}
            </div>
          )}

          {/* ---- Grid 8x12 ---- */}
          <WellGrid
            grid={grid}
            selected={selected}
            isEditable={isEditable}
            selectedSet={selectedSet}
            dragOver={dragOver}
            dragSource={dragSource}
            isDraggingSelection={isDraggingSelection}
            cursorColor="#065f46"
            cursorShadow="#34d399"
            wellColors={(w) => w.tem_resultado ? REPETIDO_COLORS : TIPO_COLORS[w.tipo_conteudo]}
            onDrop={(src, dst) => {
              setGrid(prev => {
                const next = [...prev]
                const srcPos = next[src].posicao
                const dstPos = next[dst].posicao
                next[src] = { ...next[dst], posicao: srcPos }
                next[dst] = { ...prev[src], posicao: dstPos }
                return next
              })
              setSelectedSet(new Set())
            }}
            onMultiDrop={(moves) => {
              setGrid(prev => {
                const next = [...prev]
                const moving = moves.map(({ from }) => ({ ...prev[from] }))
                moves.forEach(({ from }) => {
                  next[from] = { ...next[from], tipo_conteudo: TIPO.VAZIO, amostra_id: null, amostra_codigo: '', tem_resultado: false }
                })
                moves.forEach(({ to }, i) => {
                  next[to] = { ...moving[i], posicao: next[to].posicao }
                })
                return next
              })
              setSelectedSet(new Set(moves.map(({ to }) => to)))
            }}
            onDragOver={setDragOver}
            onDragEnd={() => { dragSource.current = null; isDraggingSelection.current = false }}
            onClick={(idx, e) => {
              const w = grid[idx]
              if (e.ctrlKey || e.metaKey) {
                setSelectedSet(prev => {
                  const next = new Set(prev)
                  if (next.has(idx)) next.delete(idx); else next.add(idx)
                  return next
                })
                lastClicked.current = idx
              } else if (e.shiftKey && lastClicked.current !== null) {
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
            onContextMenu={clearWell}
            onFeedback={setFeedback}
            setSalva={setSalva}
            setSelectedSet={setSelectedSet}
          />

          {/* ---- Ações ---- */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            {isEditable && (
              <button
                onClick={salvarPlaca}
                disabled={carregando || totalAmostras === 0 || !hasControls}
                style={{ ...btnStyle('#065f46'), opacity: (carregando || totalAmostras === 0 || !hasControls) ? 0.5 : 1 }}
              >
                {carregando ? 'Salvando...' : 'Salvar Placa PCR'}
              </button>
            )}
            {placa && !placa.local && (
              <button
                onClick={salvarComoNova}
                disabled={carregando || totalAmostras === 0 || !hasControls}
                title="Cria uma nova placa PCR com os mesmos poços, sem alterar a original"
                style={{ ...btnStyle('#1a3a5c'), opacity: (carregando || totalAmostras === 0 || !hasControls) ? 0.5 : 1 }}
              >
                {carregando ? 'Salvando...' : 'Salvar como nova placa'}
              </button>
            )}
          {/* Enviar ao termociclador — só para placa PCR salva e aberta */}
          {placa && !placa.local && placa.status_placa === 'aberta' && salva && (
            <button
              onClick={submeterTermociclador}
              disabled={carregando}
              style={{ ...btnStyle('#fd7e14'), opacity: carregando ? 0.5 : 1 }}
            >
              Enviar ao Termociclador
            </button>
          )}
          {/* Rodar replicata — para placas submetidas ou com resultados importados */}
          {placa && !placa.local && (placa.status_placa === 'submetida' || placa.status_placa === 'resultados_importados') && (
            <button
              onClick={rodarReplicata}
              disabled={carregando}
              style={{ ...btnStyle('#7c3aed'), opacity: carregando ? 0.5 : 1 }}
            >
              Rodar Replicata
            </button>
          )}
            {salva && placa && !placa.local && isEspecialista() && (
              <a
                href={`/api/placas/${placa.id}/pdf/`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...btnStyle('#4b5563'), textDecoration: 'none', display: 'inline-block' }}
              >
                Exportar PDF
              </a>
            )}
            {isEditable && placa && (
              <button
                onClick={excluirPlaca}
                disabled={carregando}
                style={{ ...btnStyle('#dc3545'), opacity: carregando ? 0.5 : 1 }}
              >
                Excluir Placa
              </button>
            )}
            <button onClick={resetar} style={btnStyle('#6b7280')}>
              {placa ? 'Fechar' : 'Voltar'}
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

const thStyle = { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }
const tdStyle = { padding: '0.5rem 0.75rem', color: '#374151' }
