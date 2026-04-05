/**
 * DataGrid — Tabela densa reutilizável com sticky columns e zebra stripe.
 */
export default function DataGrid({
  columns = [],
  data = [],
  onRowClick,
  stickyColumns = 0,
  emptyMessage = 'Nenhum registro encontrado.',
  className = '',
}) {
  if (!data.length) {
    return (
      <div className="text-center py-12 text-neutral-400 text-[0.9rem]">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={`overflow-x-auto rounded-lg border border-neutral-200 ${className}`}>
      <table className="w-full border-collapse text-[0.85rem]">
        <thead>
          <tr className="bg-neutral-100 border-b border-neutral-200">
            {columns.map((col, i) => (
              <th
                key={col.key}
                className={`px-3 py-2.5 text-left text-[0.75rem] font-semibold text-neutral-600 uppercase tracking-wider whitespace-nowrap ${col.mono ? 'font-mono' : ''} ${i < stickyColumns ? 'sticky left-0 bg-neutral-100 z-10' : ''}`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={row.id || rowIndex}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-neutral-100 transition-colors ${onRowClick ? 'cursor-pointer hover:bg-danger-50' : ''} ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}`}
            >
              {columns.map((col, i) => (
                <td
                  key={col.key}
                  className={`px-3 py-2 whitespace-nowrap ${col.mono ? 'font-mono text-[0.8125rem]' : ''} ${i < stickyColumns ? 'sticky left-0 z-10 ' + (rowIndex % 2 === 0 ? 'bg-white' : 'bg-neutral-50') : ''}`}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
