import { useState, useRef, useEffect } from 'react'
import CrachaModal from '../components/CrachaModal'
import { getOperadorInicial, getCsrfToken } from '../utils/auth'

const ROWS = ['A','B','C','D','E','F','G','H']
const COLS = ['01','02','03','04','05','06','07','08','09','10','11','12']

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
                      title={
                        tipo === 'amostra' && p?.amostra_nome
                          ? `${p.amostra_codigo} — ${p.amostra_nome}`
                          : pos
                      }
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

function LinhaPlaca({ p, onConfirmar }) {
  const [aberta, setAberta] = useState(false)

  const amostras = (p.pocos || [])
    .filter(w => w.tipo_conteudo === 'amostra' && w.amostra_codigo)
    .sort((a, b) => a.posicao.localeCompare(b.posicao))

  return (
    <>
      <tr
        onClick={() => setAberta(v => !v)}
        className={`cursor-pointer transition-colors ${aberta ? 'bg-purple-50 border-b-0' : 'border-b border-gray-100'}`}
      >
        <td className="px-3 py-2 text-gray-700 font-semibold">
          <span className="mr-1.5 text-xs text-gray-500">
            {aberta ? '▼' : '▶'}
          </span>
          {p.codigo}
        </td>
        <td className="px-3 py-2 text-gray-700">{p.total_amostras}</td>
        <td className="px-3 py-2 text-gray-700">{p.responsavel_nome || '—'}</td>
        <td className="px-3 py-2 text-gray-700">{fmtDate(p.data_criacao)}</td>
        <td className="px-3 py-2 whitespace-nowrap">
          <button
            onClick={e => { e.stopPropagation(); onConfirmar(p.codigo) }}
            className="px-2 py-1 rounded bg-purple-500 text-white text-xs font-medium cursor-pointer border-none hover:bg-purple-600"
          >
            Confirmar Extração
          </button>
        </td>
      </tr>

      {aberta && (
        <tr className="border-b border-gray-100 bg-purple-50">
          <td colSpan={5} className="px-4 py-3 pl-5">
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

            {amostras.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-purple-600 select-none">
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
    <div>
      {!operador && (
        <CrachaModal
          onValidado={(op) => { setOperador(op); setTimeout(() => extracaoRef.current?.focus(), 100) }}
          modulo="Confirmar Extração"
        />
      )}

      {operador && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-5 mb-7">
          <h3 className="text-base font-bold text-purple-600 mb-2 mt-0">
            Confirmar Extração
          </h3>

          <div className="flex items-center gap-3 bg-success-50 border border-success-200 rounded-lg px-4 py-2.5 mb-3">
            <span className="text-sm text-success-700 font-semibold">
              Operador: {operador.nome_completo}
            </span>
            <span className="text-xs bg-success-100 text-success-700 px-1.5 py-0.5 rounded-full font-medium">
              {operador.perfil}
            </span>
            <button
              onClick={() => setOperador(null)}
              className="ml-auto bg-none border border-success-200 rounded-md px-3 py-1 text-xs text-success-700 cursor-pointer font-medium hover:bg-success-100"
            >
              Trocar operador
            </button>
          </div>

          <p className="text-gray-500 text-sm mb-3">
            Escaneie o código de barras da placa após a extração de DNA para marcar todas as amostras como <b>Extraída</b>.
          </p>
          <form onSubmit={e => { e.preventDefault(); handleConfirmarExtracao() }} className="flex gap-2 max-w-[500px] mb-3">
            <input
              ref={extracaoRef}
              type="text"
              value={codigoExtracao}
              onChange={e => setCodigoExtracao(e.target.value)}
              placeholder="Escanear código da placa..."
              disabled={carregandoExtracao}
              autoComplete="off"
              className="flex-1 px-3 py-2.5 text-sm border-2 border-purple-300 rounded-md outline-none"
            />
            <button
              type="submit"
              disabled={carregandoExtracao || !codigoExtracao.trim()}
              className={`px-5 py-2.5 rounded-md bg-purple-500 text-white font-medium text-sm cursor-pointer hover:bg-purple-600 ${
                (carregandoExtracao || !codigoExtracao.trim()) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {carregandoExtracao ? 'Confirmando...' : 'Confirmar'}
            </button>
          </form>
          {feedbackExtracao && (
            <div className="rounded-md overflow-hidden">
              <div className={`px-4 py-2.5 ${
                feedbackExtracao.tipo === 'sucesso'
                  ? 'bg-success-50 text-success-700 border border-success-200'
                  : 'bg-danger-50 text-danger-700 border border-danger-200'
              }`}>
                {feedbackExtracao.msg}
              </div>
              {feedbackExtracao.tipo === 'sucesso' && amostrasExtraidas.length > 0 && (
                <div className="px-4 py-2 bg-success-50 border-t border-success-200 text-xs text-success-700">
                  <b>Amostras extraídas:</b> {amostrasExtraidas.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Buscar por código (ex: PL2603)"
            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded text-sm"
          />
          <button onClick={() => fetchPlacas()} className="px-4 py-2 rounded-md bg-gray-600 text-white font-medium text-sm cursor-pointer hover:bg-gray-700">
            Atualizar
          </button>
        </div>

        <p className="text-gray-500 text-sm mb-4">
          Placas com status <b>Aberta</b> aguardando confirmação de extração.
        </p>

        {loading ? (
          <p className="text-gray-500 py-4">Carregando...</p>
        ) : placas.length === 0 ? (
          <p className="text-gray-400 py-4">Nenhuma placa pendente de confirmação.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">Código</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">Amostras</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">Responsável</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">Data</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">Ação</th>
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