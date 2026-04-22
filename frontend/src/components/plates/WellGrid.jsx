import { ROWS, COLS, COL_LABELS, TIPO, THEMES } from './PlateConstants'

/**
 * Grid 8x12 reutilizável para MontarPlaca e MontarPCR.
 *
 * Props:
 *   grid          — array de 96 wells
 *   selected      — índice do cursor atual
 *   isEditable    — habilita drag, click, context-menu
 *   selectedSet   — Set de índices selecionados (multi-select)
 *   dragOver      — índice com hover de drag (ou null)
 *   dragSource    — ref para índice de origem do drag
 *   isDraggingSelection — ref booleana
 *   theme         — objeto de tema (de THEMES em PlateConstants); define cores dos poços e cursor
 *                   Se omitido, usa THEMES.extracao
 *   wellColors    — fn(well) → { bg, border, text } | null  (escape hatch opcional)
 *                   Se fornecido e retornar não-null, tem prioridade sobre theme.
 *                   Útil para MontarPlaca (5 cores de grupo) e overrides pontuais.
 *   onDrop        — fn(srcIdx, dstIdx)
 *   onMultiDrop   — fn(moves[{from,to}])
 *   onDragOver    — fn(idx)
 *   onDragEnd     — fn()
 *   onClick       — fn(idx, event)
 *   onContextMenu — fn(idx)
 *   onFeedback    — fn({tipo, msg})
 *   setSalva      — fn(bool)
 *   setSelectedSet — fn(Set)
 */

function resolveColors(w, theme, wellColors) {
  if (wellColors) {
    const custom = wellColors(w)
    if (custom) return custom
  }
  return theme[w.tipo_conteudo] ?? theme.vazio
}

export default function WellGrid({
  grid,
  selected,
  isEditable,
  selectedSet,
  dragOver,
  dragSource,
  isDraggingSelection,
  theme = THEMES.extracao,
  wellColors,
  onDrop,
  onMultiDrop,
  onDragOver,
  onDragEnd,
  onClick,
  onContextMenu,
  onFeedback,
  setSalva,
  setSelectedSet,
}) {
  const cursorBorder = theme.cursor?.border ?? 'border-[#1a3a5c]'
  const cursorRing   = theme.cursor?.ring   ?? 'ring-[#1a3a5c]'

  function handleDrop(e, idx) {
    e.preventDefault()
    const src = dragSource.current
    if (src === null || src === idx) { onDragOver(null); return }

    if (isDraggingSelection.current) {
      const rowOff = Math.floor(idx / 12) - Math.floor(src / 12)
      const colOff = (idx % 12) - (src % 12)
      const moves = []
      for (const si of selectedSet) {
        const toRow = Math.floor(si / 12) + rowOff
        const toCol = (si % 12) + colOff
        if (toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 12) {
          onFeedback({ tipo: 'aviso', msg: 'Movimento fora dos limites da placa.' })
          onDragOver(null); return
        }
        const toIdx = toRow * 12 + toCol
        if (grid[toIdx].tipo_conteudo !== TIPO.VAZIO && !selectedSet.has(toIdx)) {
          onFeedback({ tipo: 'aviso', msg: 'Posição de destino ocupada.' })
          onDragOver(null); return
        }
        moves.push({ from: si, to: toIdx })
      }
      onMultiDrop(moves)
    } else {
      onDrop(src, idx)
    }

    dragSource.current = null
    isDraggingSelection.current = false
    onDragOver(null)
    setSalva(false)
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="w-7" />
            {COLS.map((c, i) => (
              <th key={c} className="text-center text-[0.75rem] text-gray-500 font-medium px-0 pb-1">
                {COL_LABELS[i]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, ri) => (
            <tr key={row}>
              <td className="font-semibold text-[0.8rem] text-gray-500 text-center pr-1">
                {row}
              </td>
              {COLS.map((col, ci) => {
                const idx = ri * 12 + ci
                const w = grid[idx]
                const colors = resolveColors(w, theme, wellColors)
                const isDOver = dragOver === idx
                const isDSrc = dragSource.current === idx
                const isInSel = selectedSet.has(idx)
                const isCursor = idx === selected && isEditable && selectedSet.size === 0

                // borda: drag-over > seleção > cursor > cor do tipo
                const borderClass = isDOver
                  ? 'border-amber-400 ring-2 ring-amber-400'
                  : isInSel
                    ? 'border-violet-600 ring-2 ring-violet-400'
                    : isCursor
                      ? `${cursorBorder} ring-2 ${cursorRing}`
                      : colors.border

                return (
                  <td key={col} className="p-[1.5px]">
                    <div
                      draggable={isEditable && w.tipo_conteudo !== TIPO.VAZIO}
                      onDragStart={() => {
                        dragSource.current = idx
                        isDraggingSelection.current = selectedSet.has(idx) && selectedSet.size > 1
                      }}
                      onDragEnd={() => { onDragEnd(); onDragOver(null) }}
                      onDragOver={(e) => { if (!isEditable) return; e.preventDefault(); onDragOver(idx) }}
                      onDragLeave={() => onDragOver(null)}
                      onDrop={(e) => handleDrop(e, idx)}
                      onClick={(e) => { if (isEditable) onClick(idx, e) }}
                      onContextMenu={(e) => { e.preventDefault(); if (isEditable) onContextMenu(idx) }}
                      title={w.amostra_codigo || w.tipo_conteudo}
                      className={[
                        'w-[62px] h-10 border-2 rounded flex items-center justify-center relative',
                        'text-[0.7rem] leading-tight select-none transition-opacity',
                        colors.bg,
                        borderClass,
                        isDSrc ? 'opacity-40' : 'opacity-100',
                        isEditable && w.tipo_conteudo !== TIPO.VAZIO ? 'cursor-grab' : isEditable ? 'cursor-pointer' : 'cursor-default',
                      ].join(' ')}
                    >
                      {w.tipo_conteudo === TIPO.AMOSTRA && w.amostra_codigo && (
                        <span className={`font-bold text-[0.7rem] ${colors.text}`}>
                          {w.amostra_codigo}
                        </span>
                      )}
                      {w.tipo_conteudo === TIPO.CN && (
                        <span className={`font-bold ${colors.text}`}>CN</span>
                      )}
                      {w.tipo_conteudo === TIPO.CP && (
                        <span className={`font-bold ${colors.text}`}>CP</span>
                      )}
                      {w.tipo_conteudo !== TIPO.VAZIO && isEditable && (
                        <span
                          onClick={(e) => { e.stopPropagation(); onContextMenu(idx) }}
                          className="absolute top-[2px] right-[3px] text-gray-400 hover:text-gray-600 cursor-pointer text-[0.65rem] leading-none"
                        >
                          x
                        </span>
                      )}
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
