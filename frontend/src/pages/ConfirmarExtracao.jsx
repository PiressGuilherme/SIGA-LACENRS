import { useState, useRef, useEffect } from 'react'
import CrachaModal from '../components/CrachaModal'
import { getOperadorInicial } from '../utils/auth'
import apiFetch from '../utils/apiFetch'

const ROWS = ['A','B','C','D','E','F','G','H']
const COLS = ['01','02','03','04','05','06','07','08','09','10','11','12']

const POCO_COR = {
  amostra:           { bg: '#dbeafe', border: '#93c5fd', text: '#1e3a5f' },
  controle_positivo: { bg: '#fef3c7', border: '#fbbf24', text: '#78350f' },
  controle_negativo: { bg: '#f3e8ff', border: '#c084fc', text: '#4c1d95' },
  vazio:             { bg: '#f9fafb', border: '#e5e7eb', text: '#9ca3af' },
}

const api = (url, { csrfToken: _csrf, ...opts } = {}) => apiFetch(url, opts)

function EspelhoPlaca({ pocos }) {
  const mapa = {}
  for (const p of pocos) mapa[p.posicao] = p

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: '0.72rem', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ width: 22, padding: '2px 4px', color: '#9ca3af', fontWeight: 400 }}></th>
            {COLS.map(c => (
              <th key={c} style={{ width: 68, padding: '2px 4px', textAlign: 'center', color: '#9ca3af', fontWeight: 500 }}>
                {parseInt(c, 10)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(row => (
            <tr key={row}>
              <td style={{ padding: '2px 4px', fontWeight: 600, color: '#9ca3af', textAlign: 'center' }}>
                {row}
              </td>
              {COLS.map(col => {
                const pos = `${row}${col}`
                const p = mapa[pos]
                const tipo = p?.tipo_conteudo || 'vazio'
                const cor = POCO_COR[tipo] || POCO_COR.vazio
                const label = tipo === 'amostra'
                  ? (p.amostra_codigo || '?')
                  : tipo === 'controle_positivo' ? 'CP'
                  : tipo === 'controle_negativo' ? 'CN'
                  : ''
                return (
                  <td key={col} style={{ padding: '2px 3px' }}>
                    <div
                      title={
                        tipo === 'amostra' && p?.amostra_nome
                          ? `${p.amostra_codigo} — ${p.amostra_nome}`
                          : pos
                      }
                      style={{
                        background: cor.bg,
                        border: `1px solid ${cor.border}`,
                        borderRadius: 3,
                        padding: '3px 4px',
                        textAlign: 'center',
                        color: cor.text,
                        fontWeight: tipo === 'amostra' ? 600 : 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minHeight: 22,
                        lineHeight: '16px',
                      }}
                    >
                      {label}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LinhaPlaca({ p, onConfirmar }) {
  const [aberta, setAberta] = useState(false)

  const amostras = (p.pocos || [])
    .filter(w => w.tipo_conteudo === 'amostra' && w.amostra_codigo)
    .sort((a, b) => a.posicao.localeCompare(b.posicao))

  return (
    <>
      <tr
        onClick={() => setAberta(v => !v)}
        style={{
          borderBottom: aberta ? 'none' : '1px solid #f0f0f0',
          cursor: 'pointer',
          background: aberta ? '#f5f3ff' : undefined,
          transition: 'background 0.15s',
        }}
      >
        <td style={{ ...tdStyle, fontWeight: 600 }}>
          <span style={{ marginRight: 5, fontSize: '0.7rem', color: '#6b7280' }}>
            {aberta ? '▼' : '▶'}
          </span>
          {p.codigo}
        </td>
        <td style={tdStyle}>{p.total_amostras}</td>
        <td style={tdStyle}>{p.responsavel_nome || '—'}</td>
        <td style={tdStyle}>{fmtDate(p.data_criacao)}</td>
        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
          <button
            onClick={e => { e.stopPropagation(); onConfirmar(p.codigo) }}
            style={btnSmall('#6f42c1')}
          >
            Confirmar Extração
          </button>
        </td>
      </tr>

      {aberta && (
        <tr style={{ borderBottom: '1px solid #f0f0f0', background: '#f5f3ff' }}>
          <td colSpan={5} style={{ padding: '0.75rem 1rem 1rem 1.25rem' }}>
            <div style={{ marginBottom: '0.6rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { tipo: 'amostra',           label: 'Amostra' },
                { tipo: 'controle_positivo', label: 'CP' },
                { tipo: 'controle_negativo', label: 'CN' },
                { tipo: 'vazio',             label: 'Vazio' },
              ].map(({ tipo, label }) => {
                const cor = POCO_COR[tipo]
                return (
                  <span key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#374151' }}>
                    <span style={{
                      display: 'inline-block', width: 12, height: 12, borderRadius: 2,
                      background: cor.bg, border: `1px solid ${cor.border}`,
                    }} />
                    {label}
                  </span>
                )
              })}
              <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginLeft: 'auto' }}>
                Passe o mouse sobre uma célula para ver o nome da paciente
              </span>
            </div>

            <EspelhoPlaca pocos={p.pocos || []} />

            {amostras.length > 0 && (
              <details style={{ marginTop: '0.75rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#6f42c1', userSelect: 'none' }}>
                  Lista de amostras ({amostras.length})
                </summary>
                <div style={{
                  marginTop: '0.4rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '0.25rem 1rem',
                  fontSize: '0.8rem',
                  color: '#374151',
                }}>
                  {amostras.map(w => (
                    <div key={w.id} style={{ display: 'flex', gap: '0.4rem' }}>
                      <span style={{ color: '#9ca3af', minWidth: 30 }}>{w.posicao}</span>
                      <span style={{ fontWeight: 600, color: '#1e3a5f', minWidth: 60 }}>{w.amostra_codigo}</span>
                      <span style={{ color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {w.amostra_nome || ''}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

export default function ConfirmarExtracao({ csrfToken }) {
  const [placas, setPlacas] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const [operador, setOperador] = useState(() => getOperadorInicial())
  const [codigoExtracao, setCodigoExtracao] = useState('')
  const [feedbackExtracao, setFeedbackExtracao] = useState(null)
  const [amostrasExtraidas, setAmostrasExtraidas] = useState([])
  const [carregandoExtracao, setCarregandoExtracao] = useState(false)
  const extracaoRef = useRef()

  useEffect(() => { fetchPlacas() }, [])
  useEffect(() => { if (!carregandoExtracao) extracaoRef.current?.focus() }, [carregandoExtracao])

  async function fetchPlacas(s = search) {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('tipo_placa', 'extracao')
      params.append('status_placa', 'aberta')
      if (s.trim()) params.append('search', s.trim())
      const data = await api(`/api/placas/?${params}`, { csrfToken })
      setPlacas(data.results || data)
    } catch {
      setPlacas([])
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e) {
    const val = e.target.value
    setSearch(val)
    fetchPlacas(val)
  }

  async function handleConfirmarExtracao(placaCodigo) {
    const val = placaCodigo || codigoExtracao.trim()
    if (!val) return
    setCarregandoExtracao(true)
    setFeedbackExtracao(null)
    setAmostrasExtraidas([])
    try {
      const body = { codigo: val }
      if (operador) body.numero_cracha = operador.numero_cracha
      const data = await api('/api/placas/confirmar-extracao/', {
        csrfToken, method: 'POST', body,
      })
      const pocos = data.placa?.pocos || []
      const codigos = pocos
        .filter(p => p.tipo_conteudo === 'amostra' && p.amostra_codigo)
        .map(p => p.amostra_codigo)
        .sort()
      setAmostrasExtraidas(codigos)
      setFeedbackExtracao({
        tipo: 'sucesso',
        msg: `Placa ${val} — ${codigos.length} amostra${codigos.length !== 1 ? 's' : ''} marcada${codigos.length !== 1 ? 's' : ''} como Extraída.`,
      })
      fetchPlacas()
    } catch (err) {
      setFeedbackExtracao({ tipo: 'erro', msg: err.data?.erro || 'Placa não encontrada ou já processada.' })
    } finally {
      setCodigoExtracao('')
      setCarregandoExtracao(false)
    }
  }

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {!operador && (
        <CrachaModal
          onValidado={(op) => { setOperador(op); setTimeout(() => extracaoRef.current?.focus(), 100) }}
          modulo="Confirmar Extração"
        />
      )}

      {operador && (
        <div style={{
          background: '#faf5ff', border: '1px solid #e9d8fd', borderRadius: 8,
          padding: '1.25rem', marginBottom: '1.75rem',
        }}>
          <h3 style={{ fontSize: '1rem', color: '#6f42c1', marginBottom: '0.5rem', marginTop: 0 }}>
            Confirmar Extração
          </h3>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            background: '#f0fdf4', border: '1px solid #6ee7b7', borderRadius: 8,
            padding: '0.6rem 1rem', marginBottom: '0.75rem',
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

          <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            Escaneie o código de barras da placa após a extração de DNA para marcar todas as amostras como <b>Extraída</b>.
          </p>
          <form onSubmit={e => { e.preventDefault(); handleConfirmarExtracao() }} style={{ display: 'flex', gap: '0.5rem', maxWidth: 500, marginBottom: '0.75rem' }}>
            <input
              ref={extracaoRef}
              type="text"
              value={codigoExtracao}
              onChange={e => setCodigoExtracao(e.target.value)}
              placeholder="Escanear código da placa..."
              disabled={carregandoExtracao}
              autoComplete="off"
              style={{
                flex: 1, padding: '0.6rem 0.75rem', fontSize: '1rem',
                border: '2px solid #c4b5fd', borderRadius: 6, outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={carregandoExtracao || !codigoExtracao.trim()}
              style={{
                ...btnStyle('#6f42c1'),
                opacity: (carregandoExtracao || !codigoExtracao.trim()) ? 0.5 : 1,
              }}
            >
              {carregandoExtracao ? 'Confirmando...' : 'Confirmar'}
            </button>
          </form>
          {feedbackExtracao && (
            <div style={{ borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ padding: '0.6rem 1rem', ...feedbackStyles[feedbackExtracao.tipo] }}>
                {feedbackExtracao.msg}
              </div>
              {feedbackExtracao.tipo === 'sucesso' && amostrasExtraidas.length > 0 && (
                <div style={{
                  padding: '0.5rem 1rem', background: '#f0fdf4',
                  borderTop: '1px solid #bbf7d0', fontSize: '0.8rem', color: '#065f46',
                }}>
                  <b>Amostras extraídas:</b> {amostrasExtraidas.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Buscar por código (ex: PL2603)"
            style={{
              flex: 1, minWidth: 200, padding: '0.45rem 0.75rem',
              border: '1px solid #d1d5db', borderRadius: 5, fontSize: '0.85rem',
            }}
          />
          <button onClick={() => fetchPlacas()} style={{ ...btnStyle('#4b5563'), padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
            Atualizar
          </button>
        </div>

        <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Placas com status <b>Aberta</b> aguardando confirmação de extração.
        </p>

        {loading ? (
          <p style={{ color: '#6b7280', padding: '1rem 0' }}>Carregando...</p>
        ) : placas.length === 0 ? (
          <p style={{ color: '#9ca3af', padding: '1rem 0' }}>Nenhuma placa pendente de confirmação.</p>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={thStyle}>Código</th>
                  <th style={thStyle}>Amostras</th>
                  <th style={thStyle}>Responsável</th>
                  <th style={thStyle}>Data</th>
                  <th style={thStyle}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {placas.map(p => (
                  <LinhaPlaca key={p.id} p={p} onConfirmar={handleConfirmarExtracao} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

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

const btnSmall = (bg) => ({
  background: bg, color: '#fff', border: 'none', padding: '0.25rem 0.65rem',
  borderRadius: 4, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500,
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