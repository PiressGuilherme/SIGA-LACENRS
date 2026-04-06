import { useState, useEffect } from 'react'
import CrachaModal from '../components/CrachaModal'
import { getOperadorInicial, getCsrfToken } from '../utils/auth'

const ROWS = ['A','B','C','D','E','F','G','H']
const COLS = ['01','02','03','04','05','06','07','08','09','10','11','12']

const STATUS_PLACA = {
  aberta:                { bg: '#0d6efd', label: 'Aberta' },
  submetida:             { bg: '#fd7e14', label: 'Submetida' },
  resultados_importados: { bg: '#198754', label: 'Resultados' },
}

const POCO_COR = {
  amostra:           { bg: '#dbeafe', border: '#93c5fd', text: '#1e3a5f' },
  controle_positivo: { bg: '#fef3c7', border: '#fbbf24', text: '#78350f' },
  controle_negativo: { bg: '#f3e8ff', border: '#c084fc', text: '#4c1d95' },
  vazio:             { bg: '#f9fafb', border: '#e5e7eb', text: '#9ca3af' },
}

async function api(url, { csrfToken, method = 'GET', body } = {}) {
  const token = localStorage.getItem('access_token')
  const opts = {
    method,
    headers: {
      'X-CSRFToken': getCsrfToken(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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

// ── Mini espelho de placa 8×12 ────────────────────────────────────────────────
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
                      title={tipo === 'amostra' && p?.amostra_nome ? `${p.amostra_codigo} — ${p.amostra_nome}` : pos}
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

// ── Linha de placa PCR com expandável ─────────────────────────────────────────
function LinhaPlacaPCR({ p, csrfToken, onAtualizar, onEditar }) {
  const [aberta, setAberta] = useState(false)
  const [submetendo, setSubmetendo] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const badge = STATUS_PLACA[p.status_placa] || { bg: '#6c757d', label: p.status_display }

  const amostras = (p.pocos || [])
    .filter(w => w.tipo_conteudo === 'amostra' && w.amostra_codigo)
    .sort((a, b) => a.posicao.localeCompare(b.posicao))

  async function handleSubmeter(e) {
    e.stopPropagation()
    if (!window.confirm(`Enviar placa ${p.codigo} ao termociclador?`)) return
    setSubmetendo(true)
    try {
      await api(`/api/placas/${p.id}/submeter/`, { csrfToken, method: 'POST' })
      setFeedback({ tipo: 'sucesso', msg: `Placa ${p.codigo} enviada ao termociclador.` })
      onAtualizar()
    } catch (err) {
      setFeedback({ tipo: 'erro', msg: err.data?.erro || 'Erro ao submeter.' })
    } finally {
      setSubmetendo(false)
    }
  }

  return (
    <>
      <tr
        onClick={() => setAberta(v => !v)}
        style={{
          borderBottom: (aberta || feedback) ? 'none' : '1px solid #f0f0f0',
          cursor: 'pointer',
          background: aberta ? '#fff7ed' : undefined,
          transition: 'background 0.15s',
        }}
        title="Clique para ver as amostras na placa"
      >
        <td style={{ ...tdStyle, fontWeight: 600 }}>
          <span style={{ marginRight: 5, fontSize: '0.7rem', color: '#6b7280' }}>
            {aberta ? '▼' : '▶'}
          </span>
          {p.codigo}
        </td>
        <td style={{ ...tdStyle, color: '#6b7280' }}>{p.placa_origem_codigo || '—'}</td>
        <td style={tdStyle}>
          <span style={{
            background: badge.bg, color: '#fff',
            padding: '2px 8px', borderRadius: 4,
            fontSize: '0.78rem', fontWeight: 500, whiteSpace: 'nowrap',
          }}>
            {badge.label}
          </span>
        </td>
        <td style={tdStyle}>{p.total_amostras}</td>
        <td style={tdStyle}>{p.responsavel_nome || '—'}</td>
        <td style={tdStyle}>{fmtDate(p.data_criacao)}</td>
        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={e => { e.stopPropagation(); onEditar(p.id) }}
              style={btnSmall('#065f46')}
            >
              Editar
            </button>
            {p.total_amostras > 0 && (
              <a
                href={`/api/placas/${p.id}/pdf/`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ ...btnSmall('#4b5563'), textDecoration: 'none', display: 'inline-block' }}
              >
                PDF
              </a>
            )}
            {p.status_placa === 'aberta' && (
              <button
                onClick={handleSubmeter}
                disabled={submetendo}
                style={{ ...btnSmall('#fd7e14'), opacity: submetendo ? 0.6 : 1 }}
              >
                {submetendo ? 'Enviando...' : 'Enviar ao termociclador'}
              </button>
            )}
          </div>
        </td>
      </tr>

      {feedback && (
        <tr style={{ borderBottom: aberta ? 'none' : '1px solid #f0f0f0', background: aberta ? '#fff7ed' : undefined }}>
          <td colSpan={7} style={{ padding: '0 0.75rem 0.5rem' }}>
            <div style={{ padding: '0.4rem 0.75rem', borderRadius: 5, fontSize: '0.8rem', ...feedbackStyles[feedback.tipo] }}>
              {feedback.msg}
            </div>
          </td>
        </tr>
      )}

      {aberta && (
        <tr style={{ borderBottom: '1px solid #f0f0f0', background: '#fff7ed' }}>
          <td colSpan={7} style={{ padding: '0.75rem 1rem 1rem 1.25rem' }}>
            {/* Legenda */}
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

            {/* Lista compacta de amostras */}
            {amostras.length > 0 && (
              <details style={{ marginTop: '0.75rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#fd7e14', userSelect: 'none' }}>
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

// ================================================================
export default function ConsultarPCR({ csrfToken, onEditar }) {
  const [operador, setOperador] = useState(() => getOperadorInicial())
  const [placas, setPlacas] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => { fetchPlacas() }, [])

  async function fetchPlacas(s = search, sf = statusFilter) {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('tipo_placa', 'pcr')
      if (s.trim()) params.append('search', s.trim())
      if (sf) params.append('status_placa', sf)
      const data = await api(`/api/placas/?${params}`, { csrfToken })
      setPlacas(data.results || data)
    } catch {
      setPlacas([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* Modal bloqueante de identificação */}
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="Consultar Placas PCR" />
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); fetchPlacas(e.target.value, statusFilter) }}
          placeholder="Buscar por código..."
          style={{ flex: 1, minWidth: 200, padding: '0.45rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 5, fontSize: '0.85rem' }}
        />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); fetchPlacas(search, e.target.value) }}
          style={{ padding: '0.45rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 5, fontSize: '0.85rem', background: '#fff' }}
        >
          <option value="">Todos os status</option>
          <option value="aberta">Aberta</option>
          <option value="submetida">Submetida</option>
          <option value="resultados_importados">Resultados</option>
        </select>
        <button onClick={() => fetchPlacas()} style={{ ...btnStyle('#4b5563'), padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
          Atualizar
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#6b7280', padding: '1rem 0' }}>Carregando...</p>
      ) : placas.length === 0 ? (
        <p style={{ color: '#9ca3af', padding: '1rem 0' }}>Nenhuma placa PCR encontrada.</p>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                <th style={thStyle}>Código PCR</th>
                <th style={thStyle}>Extração base</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Amostras</th>
                <th style={thStyle}>Responsável</th>
                <th style={thStyle}>Data</th>
                <th style={thStyle}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {placas.map(p => (
                <LinhaPlacaPCR key={p.id} p={p} csrfToken={csrfToken} onAtualizar={fetchPlacas} onEditar={onEditar} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const btnStyle = (bg) => ({ background: bg, color: '#fff', border: 'none', padding: '0.6rem 1.25rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 })
const btnSmall = (bg) => ({ background: bg, color: '#fff', border: 'none', padding: '0.25rem 0.65rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500 })
const thStyle = { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }
const tdStyle = { padding: '0.5rem 0.75rem', color: '#374151' }
const feedbackStyles = {
  sucesso: { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' },
  erro:    { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' },
}
