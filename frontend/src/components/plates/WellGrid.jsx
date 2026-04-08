import { ROWS, COLS, TIPO } from './PlateConstants'

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
 *   cursorColor   — cor da borda/sombra do cursor (default '#1a3a5c')
 *   wellColors    — fn(well) → { bg, border, text }
 *   onDrop        — fn(srcIdx, dstIdx) chamado quando drop ocorre
 *   onMultiDrop   — fn(moves[{from,to}]) chamado quando drop de seleção
 *   onDragOver    — fn(idx)
 *   onDragEnd     — fn()
 *   onClick       — fn(idx, event)
 *   onContextMenu — fn(idx)
 *   onFeedback    — fn({tipo, msg}) para erros de drag
 *   setSalva      — fn(bool)
 *   setSelectedSet — fn(Set)
 */
export default function WellGrid({
  grid,
  selected,
  isEditable,
  selectedSet,
  dragOver,
  dragSource,
  isDraggingSelection,
  cursorColor = '#1a3a5c',
  cursorShadow,
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
  cursorShadow = cursorShadow ?? cursorColor

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
    <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ width: 28 }} />
            {COLS.map(c => (
              <th key={c} style={{ textAlign: 'center', fontSize: '0.75rem', color: '#6b7280', padding: '2px 0 4px' }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, ri) => (
            <tr key={row}>
              <td style={{ fontWeight: 600, fontSize: '0.8rem', color: '#6b7280', textAlign: 'center', paddingRight: 4 }}>
                {row}
              </td>
              {COLS.map((col, ci) => {
                const idx = ri * 12 + ci
                const w = grid[idx]
                const colors = wellColors(w)
                const isDOver = dragOver === idx
                const isDSrc = dragSource.current === idx
                const isInSel = selectedSet.has(idx)
                const isCursor = idx === selected && isEditable && selectedSet.size === 0

                return (
                  <td key={col} style={{ padding: 1.5 }}>
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
                      style={{
                        width: 62, height: 40,
                        background: colors.bg,
                        border: `2px solid ${isDOver ? '#f59e0b' : isInSel ? '#7c3aed' : isCursor ? cursorColor : colors.border}`,
                        borderRadius: 4,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: isEditable && w.tipo_conteudo !== TIPO.VAZIO ? 'grab' : isEditable ? 'pointer' : 'default',
                        fontSize: '0.7rem', lineHeight: 1.2,
                        position: 'relative',
                        boxShadow: isDOver ? '0 0 0 2px #f59e0b' : isInSel ? '0 0 0 2px #7c3aed' : isCursor ? `0 0 0 2px ${cursorShadow}` : 'none',
                        opacity: isDSrc ? 0.4 : 1,
                      }}
                    >
                      {w.tipo_conteudo === TIPO.AMOSTRA && w.amostra_codigo && (
                        <span style={{ fontWeight: 700, color: colors.text, fontSize: '0.7rem' }}>
                          {w.amostra_codigo}
                        </span>
                      )}
                      {w.tipo_conteudo === TIPO.CN && <span style={{ fontWeight: 700, color: colors.text }}>CN</span>}
                      {w.tipo_conteudo === TIPO.CP && <span style={{ fontWeight: 700, color: colors.text }}>CP</span>}
                      {w.tipo_conteudo !== TIPO.VAZIO && isEditable && (
                        <span
                          onClick={(e) => { e.stopPropagation(); onContextMenu(idx) }}
                          style={{
                            position: 'absolute', top: 1, right: 3,
                            color: '#9ca3af', cursor: 'pointer', fontSize: '0.65rem', lineHeight: 1,
                          }}
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
