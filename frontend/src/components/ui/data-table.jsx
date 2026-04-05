import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

// ── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow({ columns }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-neutral-200 rounded animate-pulse" style={{ width: `${60 + (i * 17) % 40}%` }} />
        </td>
      ))}
    </tr>
  )
}

// ── Sort icon ─────────────────────────────────────────────────────────────────
function SortIcon({ sorted }) {
  if (sorted === 'asc')  return <ChevronUp className="h-3.5 w-3.5 text-rs-red" />
  if (sorted === 'desc') return <ChevronDown className="h-3.5 w-3.5 text-rs-red" />
  return <ChevronsUpDown className="h-3.5 w-3.5 text-neutral-300" />
}

/**
 * DataTable — tabela genérica com TanStack React Table v8.
 *
 * Props:
 *   columns        — definição de colunas (accessorKey/accessorFn + header + cell)
 *   data           — array de dados
 *   loading        — exibe skeleton rows quando true
 *   skeletonRows   — quantas skeleton rows mostrar (default: 8)
 *   pageSize       — registros por página (default: 50)
 *   getRowCanExpand — fn(row) → bool; habilita expansão de linha
 *   renderSubRow    — fn(row) → ReactNode; conteúdo da linha expandida
 *   onRowClick      — fn(row) chamada ao clicar na linha (conflita com expansão)
 *   emptyMessage    — texto quando não há dados
 *   globalFilter    — valor de filtro global (controlado externamente)
 *   className       — classes extras para o wrapper
 */
export default function DataTable({
  columns,
  data,
  loading = false,
  skeletonRows = 8,
  pageSize = 50,
  getRowCanExpand,
  renderSubRow,
  onRowClick,
  emptyMessage = 'Nenhum registro encontrado.',
  globalFilter = '',
  className,
}) {
  const [sorting, setSorting]   = useState([])
  const [expanded, setExpanded] = useState({})

  const table = useReactTable({
    data,
    columns,
    state: { sorting, expanded, globalFilter },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand,
    initialState: { pagination: { pageSize } },
  })

  const { rows } = table.getRowModel()
  const colCount = columns.length + (getRowCanExpand ? 0 : 0)

  return (
    <div className={cn('w-full', className)}>
      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border border-neutral-200 shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="bg-neutral-50 border-b border-neutral-200">
                {headerGroup.headers.map(header => {
                  const canSort = header.column.getCanSort()
                  const sorted  = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={cn(
                        'px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide whitespace-nowrap select-none',
                        canSort && 'cursor-pointer hover:text-neutral-800 hover:bg-neutral-100 transition-colors'
                      )}
                      style={{ width: header.column.columnDef.size ? `${header.column.columnDef.size}px` : undefined }}
                    >
                      <span className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && <SortIcon sorted={sorted} />}
                      </span>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <SkeletonRow key={i} columns={columns.length} />
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-neutral-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <>
                  <tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original) : getRowCanExpand ? () => row.toggleExpanded() : undefined}
                    className={cn(
                      'border-b border-neutral-100 transition-colors',
                      rowIndex % 2 === 0 ? 'bg-white' : 'bg-neutral-50',
                      (onRowClick || getRowCanExpand) && 'cursor-pointer hover:bg-danger-50'
                    )}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-3 text-neutral-700">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() && renderSubRow && (
                    <tr key={`${row.id}-expanded`} className="bg-neutral-50 border-b border-neutral-200">
                      <td colSpan={columns.length} className="px-4 py-4">
                        {renderSubRow(row)}
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {!loading && data.length > pageSize && (
        <div className="flex items-center justify-between mt-3 text-sm text-neutral-600">
          <span>
            Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()} ·{' '}
            <span className="text-neutral-400">{table.getFilteredRowModel().rows.length} registros</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1.5 rounded-md border border-neutral-200 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1.5 rounded-md border border-neutral-200 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
