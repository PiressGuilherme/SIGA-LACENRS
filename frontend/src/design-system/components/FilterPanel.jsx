/**
 * FilterPanel — Painel de filtros avançados reutilizável.
 *
 * Props:
 *   filters       — Array de { key, label, type, options?, placeholder? }
 *                   type: 'text' | 'select' | 'date' | 'dateRange'
 *   values        — Objeto com valores atuais dos filtros
 *   onFilterChange — Callback (key, value) ao mudar um filtro
 *   onClear       — Callback para limpar todos os filtros
 *   className     — Classes adicionais
 */
export default function FilterPanel({
  filters = [],
  values = {},
  onFilterChange,
  onClear,
  className = '',
}) {
  function handleChange(key, value) {
    if (onFilterChange) onFilterChange(key, value)
  }

  const hasActiveFilters = Object.values(values).some(v => v !== undefined && v !== '' && v !== null)

  return (
    <div className={`bg-white border border-neutral-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[0.8125rem] font-semibold text-neutral-700 uppercase tracking-wider">
          Filtros
        </h4>
        {hasActiveFilters && onClear && (
          <button
            onClick={onClear}
            className="text-[0.75rem] text-danger-600 hover:text-danger-700 font-medium transition-colors"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filters.map(filter => (
          <div key={filter.key}>
            <label className="block text-[0.75rem] font-medium text-neutral-600 mb-1">
              {filter.label}
            </label>

            {filter.type === 'text' && (
              <input
                type="text"
                value={values[filter.key] || ''}
                onChange={e => handleChange(filter.key, e.target.value)}
                placeholder={filter.placeholder || `Filtrar por ${filter.label.toLowerCase()}...`}
                className="w-full px-3 py-1.5 text-[0.85rem] border border-neutral-300 rounded-md outline-none bg-white transition-colors focus:border-brand-500"
              />
            )}

            {filter.type === 'select' && (
              <select
                value={values[filter.key] || ''}
                onChange={e => handleChange(filter.key, e.target.value)}
                className="w-full px-3 py-1.5 text-[0.85rem] border border-neutral-300 rounded-md outline-none bg-white transition-colors focus:border-brand-500"
              >
                <option value="">{filter.placeholder || 'Todos'}</option>
                {(filter.options || []).map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {filter.type === 'date' && (
              <input
                type="date"
                value={values[filter.key] || ''}
                onChange={e => handleChange(filter.key, e.target.value)}
                className="w-full px-3 py-1.5 text-[0.85rem] border border-neutral-300 rounded-md outline-none bg-white transition-colors focus:border-brand-500"
              />
            )}

            {filter.type === 'dateRange' && (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={values[`${filter.key}_inicio`] || ''}
                  onChange={e => handleChange(`${filter.key}_inicio`, e.target.value)}
                  placeholder="De"
                  className="flex-1 px-3 py-1.5 text-[0.85rem] border border-neutral-300 rounded-md outline-none bg-white transition-colors focus:border-brand-500"
                />
                <input
                  type="date"
                  value={values[`${filter.key}_fim`] || ''}
                  onChange={e => handleChange(`${filter.key}_fim`, e.target.value)}
                  placeholder="Até"
                  className="flex-1 px-3 py-1.5 text-[0.85rem] border border-neutral-300 rounded-md outline-none bg-white transition-colors focus:border-brand-500"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}