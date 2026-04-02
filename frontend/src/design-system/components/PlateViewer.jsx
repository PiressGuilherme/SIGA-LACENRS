/**
 * PlateViewer — Grid 96-wells interativo para visualização de placas.
 *
 * Props:
 *   wells       — Array de 96 elementos { type, label?, color? }
 *                 type: 'amostra' | 'cp' | 'cn' | 'vazio'
 *   onWellClick — Callback ao clicar em um poço (opcional)
 *   selectedWell — Índice do poço selecionado (opcional)
 *   readOnly    — Desabilita interação
 *   className   — Classes adicionais
 */
const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const COLS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))

const WELL_STYLES = {
  amostra: {
    bg: 'bg-info-100',
    border: 'border-info-400',
    text: 'text-info-700',
  },
  cp: {
    bg: 'bg-warning-100',
    border: 'border-warning-400',
    text: 'text-warning-700',
  },
  cn: {
    bg: 'bg-neutral-100',
    border: 'border-neutral-300',
    text: 'text-neutral-500',
  },
  vazio: {
    bg: 'bg-neutral-50',
    border: 'border-neutral-200',
    text: 'text-neutral-300',
  },
}

export default function PlateViewer({
  wells = Array(96).fill({ type: 'vazio' }),
  onWellClick,
  selectedWell = null,
  readOnly = false,
  className = '',
}) {
  return (
    <div className={`inline-block ${className}`}>
      {/* Header das colunas */}
      <div className="flex mb-1">
        <div className="w-8" />
        {COLS.map(col => (
          <div key={col} className="w-10 h-6 flex items-center justify-center text-[0.65rem] font-semibold text-neutral-400 font-mono">
            {col}
          </div>
        ))}
      </div>

      {/* Linhas da placa */}
      {ROWS.map((row, rowIndex) => (
        <div key={row} className="flex mb-1">
          {/* Label da linha */}
          <div className="w-8 h-10 flex items-center justify-center text-[0.7rem] font-semibold text-neutral-400 font-mono">
            {row}
          </div>

          {/* Poços */}
          {COLS.map((col, colIndex) => {
            const wellIndex = rowIndex * 12 + colIndex
            const well = wells[wellIndex] || { type: 'vazio' }
            const style = WELL_STYLES[well.type] || WELL_STYLES.vazio
            const isSelected = selectedWell === wellIndex
            const isClickable = !readOnly && onWellClick

            return (
              <button
                key={`${row}${col}`}
                onClick={isClickable ? () => onWellClick(wellIndex, well) : undefined}
                disabled={!isClickable}
                className={`
                  w-10 h-10 rounded-full border-2 m-0.5 text-[0.65rem] font-mono font-medium
                  transition-all duration-100
                  ${style.bg} ${style.border} ${style.text}
                  ${isSelected ? 'ring-2 ring-brand-500 ring-offset-1 scale-110' : ''}
                  ${isClickable ? 'cursor-pointer hover:scale-105 hover:shadow-sm' : 'cursor-default'}
                  ${readOnly ? 'opacity-80' : ''}
                `}
                title={well.label || `${row}${col} — ${well.type}`}
              >
                {well.label || ''}
              </button>
            )
          })}
        </div>
      ))}

      {/* Legenda */}
      <div className="flex gap-4 mt-3 text-[0.7rem] text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-info-100 border border-info-400" />
          Amostra
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-warning-100 border border-warning-400" />
          CP
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-neutral-100 border border-neutral-300" />
          CN
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-neutral-50 border border-neutral-200" />
          Vazio
        </span>
      </div>
    </div>
  )
}