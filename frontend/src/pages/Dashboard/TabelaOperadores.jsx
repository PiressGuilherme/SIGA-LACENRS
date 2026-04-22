/**
 * Tabela de QC por operador — visão de supervisor.
 *
 * Destaque visual quando a taxa de controles inválidos passa dos thresholds
 * (>10% amarelo, >20% vermelho) — sinal de que o operador pode precisar de
 * treinamento adicional ou revisão de procedimento.
 *
 * Suporta ordenação por qualquer coluna clicando no cabeçalho e exportação
 * CSV para reuniões de QC.
 */
import { useMemo, useState } from 'react'

const COLUNAS = [
  { key: 'nome',                    label: 'Operador',                    align: 'left' },
  { key: 'perfil',                  label: 'Perfil',                      align: 'left' },
  { key: 'amostras_aliquotadas',    label: 'Aliq.',                       align: 'right' },
  { key: 'extracoes_montadas',      label: 'Ext. montadas',               align: 'right' },
  { key: 'extracoes_confirmadas',   label: 'Ext. conf.',                  align: 'right' },
  { key: 'placas_pcr_montadas',     label: 'PCR montadas',                align: 'right' },
  { key: 'controles_invalidos',     label: 'Ctrl. inválidos',             align: 'right' },
  { key: 'pct_controles_invalidos', label: '% inválidos',                 align: 'right' },
  { key: 'resultados_confirmados',  label: 'Result. conf.',               align: 'right' },
]

function classePctInvalidos(pct) {
  if (pct >= 20) return 'bg-rose-100 text-rose-700 font-semibold'
  if (pct >= 10) return 'bg-amber-100 text-amber-700 font-semibold'
  return 'text-gray-700'
}

function baixarCSV(linhas, nomeArquivo) {
  const header = COLUNAS.map((c) => c.label).join(',')
  const rows = linhas.map((l) =>
    COLUNAS.map((c) => {
      const v = l[c.key]
      const s = v == null ? '' : String(v)
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
    }).join(','),
  )
  const blob = new Blob([[header, ...rows].join('\n')], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(url)
}

export default function TabelaOperadores({ dados, periodoLabel }) {
  const [ordem, setOrdem] = useState({ campo: 'pct_controles_invalidos', dir: 'desc' })

  const linhas = useMemo(() => {
    if (!dados?.operadores) return []
    const copia = [...dados.operadores]
    copia.sort((a, b) => {
      const va = a[ordem.campo]
      const vb = b[ordem.campo]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'string') {
        return ordem.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      return ordem.dir === 'asc' ? va - vb : vb - va
    })
    return copia
  }, [dados, ordem])

  function ordenarPor(campo) {
    setOrdem((prev) =>
      prev.campo === campo
        ? { campo, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { campo, dir: 'desc' },
    )
  }

  if (!dados) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 h-56 animate-pulse" />
    )
  }

  if (dados.total_operadores === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-400">
        Nenhuma atividade de operador registrada no período.
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800">QC por operador</h3>
          <p className="text-xs text-gray-500">
            Métricas de qualidade no período — clique nas colunas para ordenar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => baixarCSV(linhas, `qc-operadores-${periodoLabel}.csv`)}
          className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium"
        >
          Exportar CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase text-gray-500 border-b">
              {COLUNAS.map((c) => {
                const ativo = ordem.campo === c.key
                return (
                  <th
                    key={c.key}
                    onClick={() => ordenarPor(c.key)}
                    className={`py-2 px-2 font-semibold cursor-pointer select-none hover:text-gray-800 ${
                      c.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {c.label}
                    {ativo && (
                      <span className="ml-1 text-[0.7rem]">
                        {ordem.dir === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.operador_id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-2 px-2 font-medium text-gray-800">{l.nome}</td>
                <td className="py-2 px-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {l.perfil}
                  </span>
                </td>
                <td className="py-2 px-2 text-right font-mono">{l.amostras_aliquotadas}</td>
                <td className="py-2 px-2 text-right font-mono">{l.extracoes_montadas}</td>
                <td className="py-2 px-2 text-right font-mono">{l.extracoes_confirmadas}</td>
                <td className="py-2 px-2 text-right font-mono">{l.placas_pcr_montadas}</td>
                <td className="py-2 px-2 text-right font-mono">
                  {l.controles_invalidos > 0 ? (
                    <span className="text-rose-600 font-semibold">{l.controles_invalidos}</span>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </td>
                <td className="py-2 px-2 text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded font-mono text-xs ${classePctInvalidos(
                      l.pct_controles_invalidos,
                    )}`}
                  >
                    {l.pct_controles_invalidos}%
                  </span>
                </td>
                <td className="py-2 px-2 text-right font-mono">{l.resultados_confirmados}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-gray-500 flex gap-4 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-amber-100 border border-amber-300" />
          10-20% controles inválidos
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-rose-100 border border-rose-300" />
          &gt;20% — revisão recomendada
        </span>
      </div>
    </div>
  )
}
