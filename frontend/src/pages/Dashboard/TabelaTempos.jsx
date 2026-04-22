/**
 * Tempos médios de processamento por etapa do fluxo.
 *
 * Para cada etapa mostra média, mediana e P90 em horas (ou dias quando >24h).
 * Inclui barra horizontal proporcional para comparação visual rápida.
 *
 * Usa mediana como métrica principal (mais robusta a outliers).
 */
const ETAPAS = [
  { chave: 'recebimento_extracao', label: 'Recebimento → Extração', cor: '#fd7e14' },
  { chave: 'extracao_pcr',          label: 'Extração → PCR',          cor: '#0891b2' },
  { chave: 'pcr_resultado',         label: 'PCR → Resultado',         cor: '#198754' },
  { chave: 'tat_total',             label: 'TAT total',               cor: '#6f42c1' },
]

function formatarHoras(h) {
  if (h == null) return '—'
  if (h < 1) return `${Math.round(h * 60)}min`
  if (h < 24) return `${h.toFixed(1)}h`
  const dias = Math.floor(h / 24)
  const horas = Math.round(h - dias * 24)
  return horas > 0 ? `${dias}d ${horas}h` : `${dias}d`
}

function Barra({ valor, maximo, cor }) {
  if (valor == null || !maximo) return <div className="h-2 bg-gray-100 rounded" />
  const pct = Math.min(100, (valor / maximo) * 100)
  return (
    <div className="h-2 bg-gray-100 rounded overflow-hidden">
      <div
        className="h-full rounded transition-all"
        style={{ width: `${pct}%`, background: cor }}
      />
    </div>
  )
}

export default function TabelaTempos({ dados }) {
  if (!dados) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 h-56 animate-pulse" />
    )
  }

  // Para a barra, escala contra o maior valor entre as etapas (em horas)
  const maximoMediana = Math.max(
    ...ETAPAS.map((e) => dados[e.chave]?.mediana_horas || 0),
    1,
  )

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Tempo médio de processamento</h3>
        <span className="text-xs text-gray-500">
          base: <b>{dados.base_amostras}</b> amostra{dados.base_amostras === 1 ? '' : 's'} liberada{dados.base_amostras === 1 ? '' : 's'}
        </span>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-gray-500 border-b">
            <th className="py-2 pr-2 font-semibold">Etapa</th>
            <th className="py-2 px-2 font-semibold w-32">Mediana</th>
            <th className="py-2 px-2 font-semibold w-24">Média</th>
            <th className="py-2 px-2 font-semibold w-24">P90</th>
            <th className="py-2 px-2 font-semibold w-16 text-right">Amostras</th>
            <th className="py-2 pl-4 font-semibold">Comparação</th>
          </tr>
        </thead>
        <tbody>
          {ETAPAS.map((e) => {
            const stats = dados[e.chave] || {}
            const temDados = stats.amostras > 0
            return (
              <tr key={e.chave} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-3 pr-2 font-medium text-gray-800">{e.label}</td>
                <td className="py-3 px-2 font-mono">
                  {temDados ? (
                    <span className="font-semibold" style={{ color: e.cor }}>
                      {formatarHoras(stats.mediana_horas)}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="py-3 px-2 font-mono text-gray-600">
                  {formatarHoras(stats.media_horas)}
                </td>
                <td className="py-3 px-2 font-mono text-gray-600">
                  {formatarHoras(stats.p90_horas)}
                </td>
                <td className="py-3 px-2 text-right text-gray-500">
                  {stats.amostras || 0}
                </td>
                <td className="py-3 pl-4 min-w-[180px]">
                  <Barra
                    valor={stats.mediana_horas}
                    maximo={maximoMediana}
                    cor={e.cor}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="text-xs text-gray-400 mt-3">
        Mediana é mais robusta a outliers; P90 indica o tempo que 90% das amostras não ultrapassam.
      </p>
    </div>
  )
}
