import { useState, useEffect } from 'react'
import CrachaModal from '../components/CrachaModal'
import { getOperadorInicial, getCsrfToken } from '../utils/auth'

const ROWS = ['A','B','C','D','E','F','G','H']
const COLS = ['01','02','03','04','05','06','07','08','09','10','11','12']

const STATUS_PLACA = {
  aberta:                { bg: 'bg-primary-500', label: 'Aberta' },
  submetida:             { bg: 'bg-warning-500', label: 'Submetida' },
  resultados_importados: { bg: 'bg-success-600', label: 'Resultados' },
}

const POCO_COR = {
  amostra:           { bg: 'bg-info-100',    border: 'border-info-300',    text: 'text-info-800' },
  controle_positivo: { bg: 'bg-warning-100', border: 'border-warning-300', text: 'text-warning-800' },
  controle_negativo: { bg: 'bg-purple-100',  border: 'border-purple-300',  text: 'text-purple-800' },
  vazio:             { bg: 'bg-gray-50',     border: 'border-gray-200',    text: 'text-gray-400' },
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
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th className="w-[22px] p-0.5 text-gray-400 font-normal"></th>
            {COLS.map(c => (
              <th key={c} className="w-[68px] p-0.5 text-center text-gray-400 font-medium">
                {parseInt(c, 10)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(row => (
            <tr key={row}>
              <td className="p-0.5 font-semibold text-gray-400 text-center">
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
                  <td key={col} className="p-[2px]">
                    <div
                      title={tipo === 'amostra' && p?.amostra_nome ? `${p.amostra_codigo} — ${p.amostra_nome}` : pos}
                      className={`${cor.bg} ${cor.border} ${cor.text} border rounded-[3px] px-1 py-[3px] text-center font-${tipo === 'amostra' ? 'semibold' : 'medium'} overflow-hidden text-ellipsis whitespace-nowrap min-h-[22px] leading-4`}
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

// ── Linha de placa PCR com expandível ─────────────────────────────────────────
function LinhaPlacaPCR({ p, csrfToken, onAtualizar, onEditar }) {
  const [aberta, setAberta] = useState(false)
  const [submetendo, setSubmetendo] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const badge = STATUS_PLACA[p.status_placa] || { bg: 'bg-gray-500', label: p.status_display }

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
        className={`cursor-pointer transition-colors ${aberta ? 'bg-warning-50 border-b-0' : 'border-b border-gray-100'}`}
        title="Clique para ver as amostras na placa"
      >
        <td className="px-3 py-2 text-gray-700 font-semibold">
          <span className="mr-1.5 text-xs text-gray-500">
            {aberta ? '▼' : '▶'}
          </span>
          {p.codigo}
        </td>
        <td className="px-3 py-2 text-gray-500">{p.placa_origem_codigo || '—'}</td>
        <td className="px-3 py-2">
          <span className={`${badge.bg} text-white px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap`}>
            {badge.label}
          </span>
        </td>
        <td className="px-3 py-2 text-gray-700">{p.total_amostras}</td>
        <td className="px-3 py-2 text-gray-700">{p.responsavel_nome || '—'}</td>
        <td className="px-3 py-2 text-gray-700">{fmtDate(p.data_criacao)}</td>
        <td className="px-3 py-2 whitespace-nowrap">
          <div className="flex gap-1.5">
            <button
              onClick={e => { e.stopPropagation(); onEditar(p.id) }}
              className="px-2 py-1 rounded bg-success-700 text-white text-xs font-medium cursor-pointer border-none hover:bg-success-800"
            >
              Editar
            </button>
            {p.total_amostras > 0 && (
              <a
                href={`/api/placas/${p.id}/pdf/`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="px-2 py-1 rounded bg-gray-600 text-white text-xs font-medium no-underline inline-block hover:bg-gray-700"
              >
                PDF
              </a>
            )}
            {p.status_placa === 'aberta' && (
              <button
                onClick={handleSubmeter}
                disabled={submetendo}
                className={`px-2 py-1 rounded bg-warning-500 text-white text-xs font-medium cursor-pointer border-none hover:bg-warning-600 ${submetendo ? 'opacity-60' : ''}`}
              >
                {submetendo ? 'Enviando...' : 'Enviar ao termociclador'}
              </button>
            )}
          </div>
        </td>
      </tr>

      {feedback && (
        <tr className={`${aberta ? 'border-b-0' : 'border-b border-gray-100'} ${aberta ? 'bg-warning-50' : ''}`}>
          <td colSpan={7} className="px-3 py-0 pb-2">
            <div className={`px-3 py-1.5 rounded text-xs ${
              feedback.tipo === 'sucesso'
                ? 'bg-success-50 text-success-700 border border-success-200'
                : 'bg-danger-50 text-danger-700 border border-danger-200'
            }`}>
              {feedback.msg}
            </div>
          </td>
        </tr>
      )}

      {aberta && (
        <tr className="border-b border-gray-100 bg-warning-50">
          <td colSpan={7} className="px-4 py-3 pl-5">
            {/* Legenda */}
            <div className="mb-2.5 flex gap-4 flex-wrap items-center">
              {[
                { tipo: 'amostra',           label: 'Amostra' },
                { tipo: 'controle_positivo', label: 'CP' },
                { tipo: 'controle_negativo', label: 'CN' },
                { tipo: 'vazio',             label: 'Vazio' },
              ].map(({ tipo, label }) => {
                const cor = POCO_COR[tipo]
                return (
                  <span key={tipo} className="flex items-center gap-1 text-xs text-gray-700">
                    <span className={`inline-block w-3 h-3 rounded-[2px] ${cor.bg} ${cor.border} border`} />
                    {label}
                  </span>
                )
              })}
              <span className="text-xs text-gray-400 ml-auto">
                Passe o mouse sobre uma célula para ver o nome da paciente
              </span>
            </div>

            <EspelhoPlaca pocos={p.pocos || []} />

            {/* Lista compacta de amostras */}
            {amostras.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-warning-600 select-none">
                  Lista de amostras ({amostras.length})
                </summary>
                <div className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-y-1 gap-x-4 text-xs text-gray-700">
                  {amostras.map(w => (
                    <div key={w.id} className="flex gap-1">
                      <span className="text-gray-400 min-w-[30px]">{w.posicao}</span>
                      <span className="font-semibold text-info-800 min-w-[60px]">{w.amostra_codigo}</span>
                      <span className="text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap">
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
    <div>
      {/* Modal bloqueante de identificação */}
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="Consultar Placas PCR" />
      )}

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); fetchPlacas(e.target.value, statusFilter) }}
          placeholder="Buscar por código..."
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded text-sm"
        />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); fetchPlacas(search, e.target.value) }}
          className="px-3 py-2 border border-gray-300 rounded text-sm bg-white"
        >
          <option value="">Todos os status</option>
          <option value="aberta">Aberta</option>
          <option value="submetida">Submetida</option>
          <option value="resultados_importados">Resultados</option>
        </select>
        <button onClick={() => fetchPlacas()} className="px-4 py-2 rounded-md bg-gray-600 text-white font-medium text-sm cursor-pointer hover:bg-gray-700">
          Atualizar
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 py-4">Carregando...</p>
      ) : placas.length === 0 ? (
        <p className="text-gray-400 py-4">Nenhuma placa PCR encontrada.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-200">
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">Código PCR</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">Extração base</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">Status</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">Amostras</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">Responsável</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">Data</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">Ações</th>
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