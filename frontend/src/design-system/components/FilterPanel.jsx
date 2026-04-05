/**
 * FilterPanel — Painel de filtros avançados reutilizável.
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

  const inputClass = "w-full px-3 py-1.5 text-[0.85rem] border border-neutral-300 rounded-md outline-none bg-white transition-colors focus:border-rs-red focus:ring-1 focus:ring-danger-100"

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
                className={inputClass}
              />
            )}

            {filter.type === 'select' && (
              <select
                value={values[filter.key] || ''}
                onChange={e => handleChange(filter.key, e.target.value)}
                className={inputClass}
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
                className={inputClass}
              />
            )}

            {filter.type === 'dateRange' && (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={values[`${filter.key}_inicio`] || ''}
                  onChange={e => handleChange(`${filter.key}_inicio`, e.target.value)}
                  className={`flex-1 ${inputClass}`}
                />
                <input
                  type="date"
                  value={values[`${filter.key}_fim`] || ''}
                  onChange={e => handleChange(`${filter.key}_fim`, e.target.value)}
                  className={`flex-1 ${inputClass}`}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
