import { useState, useEffect, useCallback, useRef } from 'react'
import CrachaModal from '../components/CrachaModal'
import { getOperadorInicial } from '../utils/auth'

const STATUS_BADGE = {
  aguardando_triagem:   { bg: 'bg-gray-500',   label: 'Aguardando Triagem' },
  exame_em_analise:     { bg: 'bg-info-500',    label: 'Exame em Análise' },
  aliquotada:           { bg: 'bg-primary-500', label: 'Aliquotada' },
  extracao:             { bg: 'bg-warning-500', label: 'Extração' },
  extraida:             { bg: 'bg-purple-500',  label: 'Extraída' },
  pcr:                  { bg: 'bg-danger-600',  label: 'PCR' },
  resultado:            { bg: 'bg-teal-500',    label: 'Resultado' },
  resultado_liberado:   { bg: 'bg-success-600', label: 'Resultado Liberado' },
  cancelada:            { bg: 'bg-danger-500',  label: 'Cancelada' },
  repeticao_solicitada: { bg: 'bg-warning-400', label: 'Repetição Solicitada' },
}

const RESULTADO_BADGE = {
  hpv_nao_detectado: { label: 'Não Detectado',         color: 'text-success-700', bg: 'bg-success-50' },
  hpv16:             { label: 'HPV-16',                 color: 'text-warning-700', bg: 'bg-warning-50' },
  hpv18:             { label: 'HPV-18',                 color: 'text-warning-700', bg: 'bg-warning-50' },
  hpv_ar:            { label: 'HPV AR',                 color: 'text-warning-700', bg: 'bg-warning-50' },
  hpv18_ar:          { label: 'HPV-18 + AR',            color: 'text-warning-700', bg: 'bg-warning-50' },
  hpv16_ar:          { label: 'HPV-16 + AR',            color: 'text-warning-700', bg: 'bg-warning-50' },
  hpv16_18:          { label: 'HPV-16 + HPV-18',        color: 'text-warning-700', bg: 'bg-warning-50' },
  hpv16_18_ar:       { label: 'HPV-16, HPV-18 + AR',   color: 'text-warning-700', bg: 'bg-warning-50' },
  invalido:          { label: 'Inválido',               color: 'text-danger-700',  bg: 'bg-danger-50' },
  inconclusivo:      { label: 'Inconclusivo',           color: 'text-gray-700',    bg: 'bg-gray-100' },
  pendente:          { label: 'Pendente',               color: 'text-gray-700',    bg: 'bg-gray-100' },
}

const STATUS_COM_RESULTADO = new Set(['resultado', 'resultado_liberado'])

const COLUNAS_BASE = [
  { key: 'codigo_interno',   label: 'Num. Interno',   sortable: true },
  { key: 'numero_gal',        label: 'Requisição',      sortable: false },
  { key: 'nome_paciente',    label: 'Paciente',        sortable: true },
  { key: 'cpf',              label: 'CPF',             sortable: false },
  { key: 'municipio',        label: 'Município',       sortable: true },
  { key: 'status',           label: 'Status',          sortable: true },
  { key: 'data_recebimento', label: 'Dt. Recebimento', sortable: true },
  { key: '_resultado',       label: 'Resultado',       sortable: false },
  { key: '_ci',              label: 'CI',              sortable: false },
  { key: '_hpv16',           label: 'HPV-16',          sortable: false },
  { key: '_hpv18',           label: 'HPV-18',          sortable: false },
  { key: '_hpvar',           label: 'HPV AR',          sortable: false },
]

// ── Canal chip individual ─────────────────────────────────────────────────────
function CanalChip({ canal }) {
  if (!canal) return <span className="text-gray-300">—</span>
  const interp = canal.interpretacao_efetiva
  const pos = interp === 'positivo'
  const neg = interp === 'negativo'
  return (
    <span className={`font-semibold text-xs ${pos ? 'text-danger-600' : neg ? 'text-success-600' : 'text-gray-400'}`}>
      {pos ? '+' : neg ? '−' : '?'}
      {canal.cq != null && (
        <span className="font-normal text-gray-500 text-[0.73rem]">
          {' '}{canal.cq.toFixed(1)}
        </span>
      )}
    </span>
  )
}

// ── Linha expandível ──────────────────────────────────────────────────────────
function LinhaAmostra({ a, resultados }) {
  const [aberta, setAberta] = useState(false)
  const [historico, setHistorico] = useState(null)
  const [carregandoHist, setCarregandoHist] = useState(false)

  const badge = STATUS_BADGE[a.status] || { bg: 'bg-gray-500', label: a.status }

  // Resultado mais recente (já vem pré-carregado do pai)
  const ultimoRes = resultados?.[0] || null
  const resBadge = ultimoRes
    ? (RESULTADO_BADGE[ultimoRes.resultado_final] || { label: ultimoRes.resultado_final_display, color: 'text-gray-700', bg: 'bg-gray-100' })
    : null

  function canalDe(res, nome) {
    return (res?.canais || []).find(c => c.canal === nome) || null
  }

  function toggle() {
    if (!aberta && !historico) carregarHistorico()
    setAberta(v => !v)
  }

  function carregarHistorico() {
    const token = localStorage.getItem('access_token')
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    setCarregandoHist(true)
    fetch(`/api/amostras/${a.id}/historico/`, { credentials: 'same-origin', headers })
      .then(r => r.json())
      .then(d => setHistorico(d))
      .catch(() => setHistorico([]))
      .finally(() => setCarregandoHist(false))
  }

  const numColunas = COLUNAS_BASE.length

  return (
    <>
      <tr
        onClick={toggle}
        className={`cursor-pointer transition-colors ${aberta ? 'bg-primary-50 border-b-0' : 'border-b border-gray-100'}`}
        title="Clique para ver histórico"
      >
        {/* Num. Interno */}
        <td className="px-3 py-2 text-gray-700 font-semibold whitespace-nowrap">
          <span className="mr-1.5 text-xs text-gray-500">
            {aberta ? '▼' : '▶'}
          </span>
          {a.codigo_interno || '—'}
        </td>
        {/* Requisição */}
        <td className="px-3 py-2 text-gray-500">{a.numero_gal}</td>
        {/* Paciente (truncado) */}
        <td className="px-3 py-2 text-gray-700" title={a.nome_paciente}>
          {a.nome_paciente?.length > 25 ? a.nome_paciente.slice(0, 25) + '...' : a.nome_paciente}
        </td>
        {/* CPF */}
        <td className="px-3 py-2 text-gray-500">{a.cpf || '—'}</td>
        {/* Município */}
        <td className="px-3 py-2 text-gray-700">{a.municipio || '—'}</td>
        {/* Status */}
        <td className="px-3 py-2">
          <span className={`${badge.bg} text-white px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap`}>
            {badge.label}
          </span>
        </td>
        {/* Dt. Recebimento */}
        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtDate(a.data_recebimento)}</td>
        {/* Resultado */}
        <td className="px-3 py-2">
          {resBadge ? (
            <span className={`${resBadge.bg} ${resBadge.color} px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap`}>
              {resBadge.label}
            </span>
          ) : <span className="text-gray-300">—</span>}
        </td>
        {/* CI */}
        <td className="px-3 py-2 text-center">
          {ultimoRes ? <CanalChip canal={canalDe(ultimoRes, 'CI')} /> : <span className="text-gray-300">—</span>}
        </td>
        {/* HPV-16 */}
        <td className="px-3 py-2 text-center">
          {ultimoRes ? <CanalChip canal={canalDe(ultimoRes, 'HPV16')} /> : <span className="text-gray-300">—</span>}
        </td>
        {/* HPV-18 */}
        <td className="px-3 py-2 text-center">
          {ultimoRes ? <CanalChip canal={canalDe(ultimoRes, 'HPV18')} /> : <span className="text-gray-300">—</span>}
        </td>
        {/* HPV AR */}
        <td className="px-3 py-2 text-center">
          {ultimoRes ? <CanalChip canal={canalDe(ultimoRes, 'HPV_AR')} /> : <span className="text-gray-300">—</span>}
        </td>
      </tr>

      {aberta && (
        <tr className="border-b border-gray-100 bg-primary-50">
          <td colSpan={numColunas} className="p-0">
            <div className="overflow-x-auto px-4 py-3 pl-8">
            {/* Dados básicos */}
            <div className="flex gap-6 flex-wrap text-xs text-gray-500 mb-3">
              <span><b className="text-gray-700">GAL:</b> {a.numero_gal}</span>
              <span><b className="text-gray-700">Cód. Amostra:</b> {a.cod_amostra_gal || '—'}</span>
              {a.recebido_por_nome && <span><b className="text-gray-700">Recebido por:</b> {a.recebido_por_nome}</span>}
              {a.data_recebimento && <span><b className="text-gray-700">Recebido em:</b> {fmtDate(a.data_recebimento)}</span>}
              {a.material && <span><b className="text-gray-700">Material:</b> {a.material}</span>}
              {a.unidade_solicitante && <span><b className="text-gray-700">Solicitante:</b> {a.unidade_solicitante}</span>}
            </div>

            {/* Timeline do histórico */}
            <div className="font-semibold text-xs text-primary-700 mb-2">
              Histórico da amostra
            </div>

            {carregandoHist && (
              <span className="text-gray-500 text-xs">Carregando...</span>
            )}

            {!carregandoHist && historico !== null && historico.length === 0 && (
              <span className="text-gray-400 text-xs">Sem histórico registrado.</span>
            )}

            {!carregandoHist && historico !== null && historico.length > 0 && (
              <div className="relative pl-6">
                {/* Linha vertical da timeline */}
                <div className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-gray-300" />

                {historico.map((h, idx) => {
                  const statusBadge = STATUS_BADGE[h.para_valor] || { bg: 'bg-gray-500', label: h.para }
                  const isLast = idx === historico.length - 1
                  return (
                    <div key={idx} className={`relative ${isLast ? '' : 'pb-2'} text-xs flex items-start gap-2`}>
                      {/* Bolinha da timeline */}
                      <div className={`absolute -left-6 top-[3px] w-2.5 h-2.5 rounded-full ${statusBadge.bg} border-2 border-white shadow-[0_0_0_1px_#d1d5db] z-[1]`} />

                      {/* Conteúdo */}
                      <div className="flex flex-wrap items-center gap-1">
                        <span className={`${statusBadge.bg} text-white px-2 py-[1px] rounded text-[0.73rem] font-semibold whitespace-nowrap`}>
                          {statusBadge.label}
                        </span>
                        {h.de && (
                          <span className="text-gray-400 text-[0.73rem]">
                            ← {h.de}
                          </span>
                        )}
                        {h.tipo === 'criacao' && (
                          <span className="text-success-600 text-[0.73rem] font-medium">
                            Importada no sistema
                          </span>
                        )}
                        <span className="text-gray-500 text-[0.73rem] whitespace-nowrap">
                          {fmtDate(h.timestamp)}
                        </span>
                        {h.actor && (
                          <span className="text-gray-700 text-[0.73rem]">
                            · {h.actor}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ConsultaAmostras() {
  const [operador, setOperador] = useState(() => getOperadorInicial())
  const [amostras, setAmostras] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [municipioFilter, setMunicipioFilter] = useState('')
  const [ordering, setOrdering] = useState('codigo_interno')
  const [filtros, setFiltros] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)
  const [resultadosMap, setResultadosMap] = useState({})
  const searchRef = useRef()
  const debounceRef = useRef()

  useEffect(() => {
    fetch('/api/amostras/filtros/', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(setFiltros)
      .catch(() => {})
  }, [])

  const fetchAmostras = useCallback(() => {
    setCarregando(true)
    setErro(null)
    const params = new URLSearchParams({ page })
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    if (municipioFilter) params.set('municipio', municipioFilter)
    if (ordering) params.set('ordering', ordering)

    const token = localStorage.getItem('access_token')
    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    fetch(`/api/amostras/?${params}`, { credentials: 'same-origin', headers })
      .then(r => {
        if (!r.ok) throw new Error(`Erro ${r.status}`)
        return r.json()
      })
      .then(data => {
        const lista = data.results || []
        setAmostras(lista)
        setTotal(data.count || 0)

        // Pré-carrega resultados das amostras com resultado na página atual
        const idsComRes = lista
          .filter(a => STATUS_COM_RESULTADO.has(a.status))
          .map(a => a.id)

        if (idsComRes.length > 0) {
          Promise.all(
            idsComRes.map(id =>
              fetch(`/api/resultados/?amostra_id=${id}`, { credentials: 'same-origin', headers })
                .then(r => r.json())
                .then(d => ({ id, resultados: d.results || d }))
                .catch(() => ({ id, resultados: [] }))
            )
          ).then(entries => {
            const map = {}
            entries.forEach(({ id, resultados }) => { map[id] = resultados })
            setResultadosMap(map)
          })
        } else {
          setResultadosMap({})
        }
      })
      .catch(e => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [page, search, statusFilter, municipioFilter, ordering])

  useEffect(() => { fetchAmostras() }, [fetchAmostras])

  function handleSearchInput(e) {
    clearTimeout(debounceRef.current)
    const val = e.target.value
    debounceRef.current = setTimeout(() => { setSearch(val); setPage(1) }, 350)
  }

  function handleSort(key) {
    setOrdering(prev => prev === key ? `-${key}` : key)
    setPage(1)
  }

  const pageSize = 50
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      {/* Modal bloqueante de identificação */}
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="Consulta de Amostras" />
      )}

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <input
          ref={searchRef}
          type="text"
          placeholder="Buscar por nome, CPF, CNS, código interno, GAL..."
          onChange={handleSearchInput}
          className="flex-1 min-w-[260px] px-3 py-2.5 text-sm border border-gray-300 rounded-md outline-none"
        />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2.5 text-sm border border-gray-300 rounded-md bg-white text-gray-700 outline-none min-w-[150px]"
        >
          <option value="">Todos os status</option>
          {(filtros?.status_choices || []).map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={municipioFilter}
          onChange={e => { setMunicipioFilter(e.target.value); setPage(1) }}
          className="px-3 py-2.5 text-sm border border-gray-300 rounded-md bg-white text-gray-700 outline-none min-w-[150px]"
        >
          <option value="">Todos os municípios</option>
          {(filtros?.municipios || []).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Contador */}
      <div className="flex items-center gap-4 mb-3 text-sm text-gray-500">
        <span><b>{total}</b> amostra{total !== 1 ? 's' : ''} encontrada{total !== 1 ? 's' : ''}</span>
        {carregando && <span className="text-primary-500">Carregando...</span>}
      </div>

      {erro && (
        <div className="bg-danger-50 text-danger-700 px-4 py-2.5 rounded-md mb-4">
          {erro}
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-auto max-h-[calc(100vh-220px)] bg-white rounded-lg border border-gray-200 mb-4">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200 sticky top-0 z-[2]">
              {COLUNAS_BASE.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={`px-3 py-2.5 text-left font-semibold whitespace-nowrap select-none ${
                    col.sortable ? 'cursor-pointer' : ''
                  } ${col.key.startsWith('_') ? 'text-success-600 border-l-2 border-gray-200' : 'text-gray-700'}`}
                >
                  {col.label}
                  {col.sortable && (
                    <span className={`ml-1 ${ordering.replace('-', '') === col.key ? 'opacity-100' : 'opacity-25'}`}>
                      {ordering === `-${col.key}` ? '▼' : '▲'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {amostras.length === 0 && !carregando && (
              <tr>
                <td colSpan={COLUNAS_BASE.length} className="px-3 py-8 text-center text-gray-400">
                  Nenhuma amostra encontrada.
                </td>
              </tr>
            )}
            {amostras.map(a => (
              <LinhaAmostra
                key={a.id}
                a={a}
                resultados={resultadosMap[a.id]}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-center">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className={`px-4 py-1.5 text-sm rounded-md border border-gray-300 ${
              page <= 1 ? 'bg-gray-100 text-gray-400 cursor-default' : 'bg-white text-gray-700 cursor-pointer'
            }`}
          >
            Anterior
          </button>
          <span className="text-sm text-gray-700">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className={`px-4 py-1.5 text-sm rounded-md border border-gray-300 ${
              page >= totalPages ? 'bg-gray-100 text-gray-400 cursor-default' : 'bg-white text-gray-700 cursor-pointer'
            }`}
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}