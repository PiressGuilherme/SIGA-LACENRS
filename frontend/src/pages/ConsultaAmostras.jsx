import { useState, useEffect, useCallback, useRef } from 'react'

const STATUS_BADGE = {
  aguardando_triagem:   { bg: '#6c757d', label: 'Aguardando Triagem' },
  exame_em_analise:     { bg: '#0dcaf0', label: 'Exame em Análise' },
  aliquotada:           { bg: '#0d6efd', label: 'Aliquotada' },
  extracao:             { bg: '#fd7e14', label: 'Extração' },
  extraida:             { bg: '#6f42c1', label: 'Extraída' },
  pcr:                  { bg: '#e53e3e', label: 'PCR' },
  resultado:            { bg: '#20c997', label: 'Resultado' },
  resultado_liberado:   { bg: '#198754', label: 'Resultado Liberado' },
  cancelada:            { bg: '#dc3545', label: 'Cancelada' },
  repeticao_solicitada: { bg: '#ffc107', label: 'Repetição Solicitada' },
}

const RESULTADO_BADGE = {
  hpv_nao_detectado: { label: 'Não Detectado',         color: '#065f46', bg: '#d1fae5' },
  hpv16:             { label: 'HPV-16',                 color: '#92400e', bg: '#fef3c7' },
  hpv18:             { label: 'HPV-18',                 color: '#92400e', bg: '#fef3c7' },
  hpv_ar:            { label: 'HPV AR',                 color: '#92400e', bg: '#fef3c7' },
  hpv18_ar:          { label: 'HPV-18 + AR',            color: '#92400e', bg: '#fef3c7' },
  hpv16_ar:          { label: 'HPV-16 + AR',            color: '#92400e', bg: '#fef3c7' },
  hpv16_18:          { label: 'HPV-16 + HPV-18',        color: '#92400e', bg: '#fef3c7' },
  hpv16_18_ar:       { label: 'HPV-16, HPV-18 + AR',   color: '#92400e', bg: '#fef3c7' },
  invalido:          { label: 'Inválido',               color: '#7f1d1d', bg: '#fee2e2' },
  inconclusivo:      { label: 'Inconclusivo',           color: '#374151', bg: '#f3f4f6' },
  pendente:          { label: 'Pendente',               color: '#374151', bg: '#f3f4f6' },
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
  if (!canal) return <span style={{ color: '#9ca3af' }}>—</span>
  const interp = canal.interpretacao_efetiva
  const pos = interp === 'positivo'
  const neg = interp === 'negativo'
  return (
    <span style={{
      fontWeight: 600,
      color: pos ? '#dc2626' : neg ? '#059669' : '#9ca3af',
      fontSize: '0.78rem',
    }}>
      {pos ? '+' : neg ? '−' : '?'}
      {canal.cq != null && (
        <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.73rem' }}>
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

  const badge = STATUS_BADGE[a.status] || { bg: '#6c757d', label: a.status }

  // Resultado mais recente (já vem pré-carregado do pai)
  const ultimoRes = resultados?.[0] || null
  const resBadge = ultimoRes
    ? (RESULTADO_BADGE[ultimoRes.resultado_final] || { label: ultimoRes.resultado_final_display, color: '#374151', bg: '#f3f4f6' })
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
        style={{
          borderBottom: aberta ? 'none' : '1px solid #f0f0f0',
          cursor: 'pointer',
          background: aberta ? '#f8faff' : undefined,
          transition: 'background 0.15s',
        }}
        title="Clique para ver histórico"
      >
        {/* Num. Interno */}
        <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>
          <span style={{ marginRight: 5, fontSize: '0.7rem', color: '#6b7280' }}>
            {aberta ? '▼' : '▶'}
          </span>
          {a.codigo_interno || '—'}
        </td>
        {/* Requisição */}
        <td style={{ ...tdStyle, color: '#6b7280' }}>{a.numero_gal}</td>
        {/* Paciente (truncado) */}
        <td style={tdStyle} title={a.nome_paciente}>
          {a.nome_paciente?.length > 25 ? a.nome_paciente.slice(0, 25) + '...' : a.nome_paciente}
        </td>
        {/* CPF */}
        <td style={{ ...tdStyle, color: '#6b7280' }}>{a.cpf || '—'}</td>
        {/* Município */}
        <td style={tdStyle}>{a.municipio || '—'}</td>
        {/* Status */}
        <td style={tdStyle}>
          <span style={{
            background: badge.bg, color: '#fff',
            padding: '2px 8px', borderRadius: 4,
            fontSize: '0.78rem', fontWeight: 500, whiteSpace: 'nowrap',
          }}>
            {badge.label}
          </span>
        </td>
        {/* Dt. Recebimento */}
        <td style={{ ...tdStyle, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtDate(a.data_recebimento)}</td>
        {/* Resultado */}
        <td style={tdStyle}>
          {resBadge ? (
            <span style={{
              background: resBadge.bg, color: resBadge.color,
              padding: '2px 8px', borderRadius: 4,
              fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              {resBadge.label}
            </span>
          ) : <span style={{ color: '#d1d5db' }}>—</span>}
        </td>
        {/* CI */}
        <td style={{ ...tdStyle, textAlign: 'center' }}>
          {ultimoRes ? <CanalChip canal={canalDe(ultimoRes, 'CI')} /> : <span style={{ color: '#d1d5db' }}>—</span>}
        </td>
        {/* HPV-16 */}
        <td style={{ ...tdStyle, textAlign: 'center' }}>
          {ultimoRes ? <CanalChip canal={canalDe(ultimoRes, 'HPV16')} /> : <span style={{ color: '#d1d5db' }}>—</span>}
        </td>
        {/* HPV-18 */}
        <td style={{ ...tdStyle, textAlign: 'center' }}>
          {ultimoRes ? <CanalChip canal={canalDe(ultimoRes, 'HPV18')} /> : <span style={{ color: '#d1d5db' }}>—</span>}
        </td>
        {/* HPV AR */}
        <td style={{ ...tdStyle, textAlign: 'center' }}>
          {ultimoRes ? <CanalChip canal={canalDe(ultimoRes, 'HPV_AR')} /> : <span style={{ color: '#d1d5db' }}>—</span>}
        </td>
      </tr>

      {aberta && (
        <tr style={{ borderBottom: '1px solid #f0f0f0', background: '#f8faff' }}>
          <td colSpan={numColunas} style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto', padding: '0.75rem 1rem 1rem 2rem' }}>
            {/* Dados básicos */}
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.75rem' }}>
              <span><b style={{ color: '#374151' }}>GAL:</b> {a.numero_gal}</span>
              <span><b style={{ color: '#374151' }}>Cód. Amostra:</b> {a.cod_amostra_gal || '—'}</span>
              {a.recebido_por_nome && <span><b style={{ color: '#374151' }}>Recebido por:</b> {a.recebido_por_nome}</span>}
              {a.data_recebimento && <span><b style={{ color: '#374151' }}>Recebido em:</b> {fmtDate(a.data_recebimento)}</span>}
              {a.material && <span><b style={{ color: '#374151' }}>Material:</b> {a.material}</span>}
              {a.unidade_solicitante && <span><b style={{ color: '#374151' }}>Solicitante:</b> {a.unidade_solicitante}</span>}
            </div>

            {/* Timeline do histórico */}
            <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1a3a5c', marginBottom: '0.5rem' }}>
              Histórico da amostra
            </div>

            {carregandoHist && (
              <span style={{ color: '#6b7280', fontSize: '0.82rem' }}>Carregando...</span>
            )}

            {!carregandoHist && historico !== null && historico.length === 0 && (
              <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>Sem histórico registrado.</span>
            )}

            {!carregandoHist && historico !== null && historico.length > 0 && (
              <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
                {/* Linha vertical da timeline */}
                <div style={{
                  position: 'absolute', left: 7, top: 4, bottom: 4, width: 2,
                  background: '#d1d5db',
                }} />

                {historico.map((h, idx) => {
                  const statusBadge = STATUS_BADGE[h.para_valor] || { bg: '#6c757d', label: h.para }
                  const isLast = idx === historico.length - 1
                  return (
                    <div key={idx} style={{
                      position: 'relative',
                      paddingBottom: isLast ? 0 : '0.6rem',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.6rem',
                    }}>
                      {/* Bolinha da timeline */}
                      <div style={{
                        position: 'absolute', left: '-1.5rem', top: 3,
                        width: 10, height: 10, borderRadius: '50%',
                        background: statusBadge.bg, border: '2px solid #fff',
                        boxShadow: '0 0 0 1px #d1d5db', zIndex: 1,
                      }} />

                      {/* Conteúdo */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{
                          background: statusBadge.bg, color: '#fff',
                          padding: '1px 8px', borderRadius: 4,
                          fontSize: '0.73rem', fontWeight: 600, whiteSpace: 'nowrap',
                        }}>
                          {statusBadge.label}
                        </span>
                        {h.de && (
                          <span style={{ color: '#9ca3af', fontSize: '0.73rem' }}>
                            ← {h.de}
                          </span>
                        )}
                        {h.tipo === 'criacao' && (
                          <span style={{ color: '#059669', fontSize: '0.73rem', fontWeight: 500 }}>
                            Importada no sistema
                          </span>
                        )}
                        <span style={{ color: '#6b7280', fontSize: '0.73rem', whiteSpace: 'nowrap' }}>
                          {fmtDate(h.timestamp)}
                        </span>
                        {h.actor && (
                          <span style={{ color: '#374151', fontSize: '0.73rem' }}>
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
    <div style={{ fontFamily: 'inherit' }}>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          ref={searchRef}
          type="text"
          placeholder="Buscar por nome, CPF, CNS, código interno, GAL..."
          onChange={handleSearchInput}
          style={{
            flex: 1, minWidth: 260, padding: '0.6rem 0.75rem', fontSize: '0.95rem',
            border: '1px solid #d1d5db', borderRadius: 6, outline: 'none',
          }}
        />
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} style={selectStyle}>
          <option value="">Todos os status</option>
          {(filtros?.status_choices || []).map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select value={municipioFilter} onChange={e => { setMunicipioFilter(e.target.value); setPage(1) }} style={selectStyle}>
          <option value="">Todos os municípios</option>
          {(filtros?.municipios || []).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Contador */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#6b7280' }}>
        <span><b>{total}</b> amostra{total !== 1 ? 's' : ''} encontrada{total !== 1 ? 's' : ''}</span>
        {carregando && <span style={{ color: '#3b82f6' }}>Carregando...</span>}
      </div>

      {erro && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.6rem 1rem', borderRadius: 6, marginBottom: '1rem' }}>
          {erro}
        </div>
      )}

      {/* Tabela */}
      <div style={{
        overflow: 'auto',
        maxHeight: 'calc(100vh - 220px)',
        background: '#fff',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        marginBottom: '1rem',
      }}>
        <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 2 }}>
              {COLUNAS_BASE.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  style={{
                    ...thStyle,
                    cursor: col.sortable ? 'pointer' : 'default',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    // destaca colunas de resultado
                    borderLeft: col.key === '_resultado' ? '2px solid #e5e7eb' : undefined,
                    color: col.key.startsWith('_') ? '#059669' : '#374151',
                  }}
                >
                  {col.label}
                  {col.sortable && (
                    <span style={{ marginLeft: 4, opacity: ordering.replace('-', '') === col.key ? 1 : 0.25 }}>
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
                <td colSpan={COLUNAS_BASE.length} style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={pageBtnStyle(page <= 1)}>
            Anterior
          </button>
          <span style={{ fontSize: '0.85rem', color: '#374151' }}>
            Página {page} de {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={pageBtnStyle(page >= totalPages)}>
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

const thStyle = {
  padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151',
}

const tdStyle = { padding: '0.5rem 0.75rem', color: '#374151' }

const selectStyle = {
  padding: '0.6rem 0.5rem', fontSize: '0.85rem',
  border: '1px solid #d1d5db', borderRadius: 6, background: '#fff',
  color: '#374151', outline: 'none', minWidth: 150,
}

function pageBtnStyle(disabled) {
  return {
    padding: '0.4rem 1rem', fontSize: '0.85rem', borderRadius: 6,
    border: '1px solid #d1d5db', background: disabled ? '#f3f4f6' : '#fff',
    color: disabled ? '#9ca3af' : '#374151', cursor: disabled ? 'default' : 'pointer',
  }
}
