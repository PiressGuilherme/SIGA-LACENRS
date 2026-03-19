import React, { useState, useEffect, useCallback, useRef } from 'react'

const STATUS_BADGE = {
  aguardando_triagem:   { bg: '#6c757d', label: 'Aguardando Triagem' },
  exame_em_analise:     { bg: '#0dcaf0', label: 'Exame em Análise' },
  aliquotada:           { bg: '#0d6efd', label: 'Aliquotada' },
  extracao:             { bg: '#fd7e14', label: 'Extração' },
  extraida:             { bg: '#6f42c1', label: 'Extraída' },
  resultado:            { bg: '#20c997', label: 'Resultado' },
  resultado_liberado:   { bg: '#198754', label: 'Resultado Liberado' },
  cancelada:            { bg: '#dc3545', label: 'Cancelada' },
  repeticao_solicitada: { bg: '#ffc107', label: 'Repetição Solicitada' },
}

const COLUNAS = [
  { key: 'codigo_interno',  label: 'Num. Interno',    sortable: true },
  { key: 'cod_exame_gal',   label: 'Cód. Exame',      sortable: false },
  { key: 'nome_paciente',   label: 'Paciente',         sortable: true },
  { key: 'cpf',             label: 'CPF',              sortable: false },
  { key: 'municipio',       label: 'Município',        sortable: true },
  { key: 'status',          label: 'Status',           sortable: true },
  { key: 'data_recebimento',label: 'Dt. Recebimento',  sortable: true },
]

export default function ConsultaAmostras({ csrfToken }) {
  const [amostras, setAmostras] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [municipioFilter, setMunicipioFilter] = useState('')
  const [ordering, setOrdering] = useState('-criado_em')
  const [filtros, setFiltros] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)
  const searchRef = useRef()
  const debounceRef = useRef()

  // Carregar opções de filtro uma vez
  useEffect(() => {
    fetch('/api/amostras/filtros/', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(setFiltros)
      .catch(() => {})
  }, [])

  // Buscar amostras
  const fetchAmostras = useCallback(() => {
    setCarregando(true)
    setErro(null)
    const params = new URLSearchParams({ page })
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    if (municipioFilter) params.set('municipio', municipioFilter)
    if (ordering) params.set('ordering', ordering)

    fetch(`/api/amostras/?${params}`, { credentials: 'same-origin' })
      .then(r => {
        if (!r.ok) throw new Error(`Erro ${r.status}`)
        return r.json()
      })
      .then(data => {
        setAmostras(data.results || [])
        setTotal(data.count || 0)
      })
      .catch(e => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [page, search, statusFilter, municipioFilter, ordering])

  useEffect(() => { fetchAmostras() }, [fetchAmostras])

  // Debounce da busca textual
  function handleSearchChange(val) {
    setSearch(val)
    setPage(1)
  }

  function handleSearchInput(e) {
    clearTimeout(debounceRef.current)
    const val = e.target.value
    debounceRef.current = setTimeout(() => handleSearchChange(val), 350)
  }

  // Ordenação
  function handleSort(key) {
    setOrdering(prev => prev === key ? `-${key}` : key)
    setPage(1)
  }

  // Paginação
  const pageSize = 50
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div style={{ fontFamily: 'inherit' }}>
      <h2 style={{ marginBottom: '1rem', fontSize: '1.3rem', color: '#1a3a5c' }}>
        Consulta de Amostras
      </h2>

      {/* Barra de busca + filtros */}
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
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          style={selectStyle}
        >
          <option value="">Todos os status</option>
          {(filtros?.status_choices || []).map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={municipioFilter}
          onChange={e => { setMunicipioFilter(e.target.value); setPage(1) }}
          style={selectStyle}
        >
          <option value="">Todos os municípios</option>
          {(filtros?.municipios || []).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Contadores */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#6b7280' }}>
        <span><b>{total}</b> amostra{total !== 1 ? 's' : ''} encontrada{total !== 1 ? 's' : ''}</span>
        {carregando && <span style={{ color: '#3b82f6' }}>Carregando...</span>}
      </div>

      {/* Erro */}
      {erro && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.6rem 1rem', borderRadius: 6, marginBottom: '1rem' }}>
          {erro}
        </div>
      )}

      {/* Tabela */}
      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
              {COLUNAS.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  style={{
                    ...thStyle,
                    cursor: col.sortable ? 'pointer' : 'default',
                    userSelect: 'none', whiteSpace: 'nowrap',
                  }}
                >
                  {col.label}
                  {col.sortable && (
                    <span style={{ marginLeft: 4, opacity: ordering.replace('-','') === col.key ? 1 : 0.25 }}>
                      {ordering === `-${col.key}` ? '\u25BC' : '\u25B2'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {amostras.length === 0 && !carregando && (
              <tr>
                <td colSpan={COLUNAS.length} style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>
                  Nenhuma amostra encontrada.
                </td>
              </tr>
            )}
            {amostras.map(a => {
              const badge = STATUS_BADGE[a.status] || { bg: '#6c757d', label: a.status_display || a.status }
              return (
                <tr key={a.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{a.codigo_interno || '\u2014'}</td>
                  <td style={tdStyle}>{a.cod_exame_gal}</td>
                  <td style={tdStyle}>{a.nome_paciente}</td>
                  <td style={tdStyle}>{a.cpf || '\u2014'}</td>
                  <td style={tdStyle}>{a.municipio || '\u2014'}</td>
                  <td style={tdStyle}>
                    <span style={{
                      background: badge.bg, color: '#fff',
                      padding: '2px 8px', borderRadius: 4,
                      fontSize: '0.78rem', fontWeight: 500, whiteSpace: 'nowrap',
                    }}>
                      {badge.label}
                    </span>
                  </td>
                  <td style={tdStyle}>{fmtDate(a.data_recebimento)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={pageBtnStyle(page <= 1)}
          >
            Anterior
          </button>
          <span style={{ fontSize: '0.85rem', color: '#374151' }}>
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={pageBtnStyle(page >= totalPages)}
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  )
}

// ---- Helpers ----

function fmtDate(iso) {
  if (!iso) return '\u2014'
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
