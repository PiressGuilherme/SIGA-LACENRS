import { ROWS, COLS, MINI_THEMES } from './PlateConstants'

/**
 * Mini grid 8×12 read-only para exibição de placas em páginas de consulta.
 *
 * Props:
 *   pocos  — array de poços da API:
 *            { posicao, tipo_conteudo, amostra_codigo, amostra_nome }
 *            tipo_conteudo esperado: 'amostra' | 'controle_positivo' | 'controle_negativo' | 'vazio'
 *   theme  — objeto de tema (de MINI_THEMES em PlateConstants)
 *            Se omitido, usa MINI_THEMES.default
 *            theme.header: classe Tailwind para a cor dos rótulos de linha/coluna
 *            theme.rowBg:  exportado para uso externo pela LinhaPlaca pai (não usado aqui)
 */
export default function PlacaMiniGrid({ pocos, theme = MINI_THEMES.default }) {
  const mapa = {}
  for (const p of pocos) mapa[p.posicao] = p

  const headerClass = theme.header ?? 'text-gray-400'

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-[0.72rem] table-fixed">
        <thead>
          <tr>
            <th className={`w-[22px] px-1 py-0.5 font-normal ${headerClass}`}></th>
            {COLS.map((c) => (
              <th
                key={c}
                className={`w-[68px] px-1 py-0.5 text-center font-medium ${headerClass}`}
              >
                {parseInt(c, 10)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row}>
              <td className={`px-1 py-0.5 font-semibold text-center ${headerClass}`}>
                {row}
              </td>
              {COLS.map((col) => {
                const pos = `${row}${col}`
                const p = mapa[pos]
                const tipo = p?.tipo_conteudo || 'vazio'
                const cor = theme[tipo] ?? theme.vazio
                const label =
                  tipo === 'amostra'
                    ? p.amostra_codigo || '?'
                    : tipo === 'controle_positivo'
                      ? 'CP'
                      : tipo === 'controle_negativo'
                        ? 'CN'
                        : ''
                return (
                  <td key={col} className="px-0.5 py-0.5">
                    <div
                      title={
                        tipo === 'amostra' && p?.amostra_nome
                          ? `${p.amostra_codigo} — ${p.amostra_nome}`
                          : pos
                      }
                      className={[
                        cor.bg, cor.border, cor.text,
                        'border rounded px-1 py-0.5 text-center font-medium',
                        'overflow-hidden text-ellipsis whitespace-nowrap',
                        'min-h-[22px] leading-[16px]',
                        tipo === 'amostra' ? 'font-semibold' : '',
                      ].join(' ')}
                    >
                      {label}
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
