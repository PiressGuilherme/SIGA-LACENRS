/**
 * Linha de cards do topo com indicadores principais.
 *
 * Cada card mostra um valor e, quando aplicável, uma comparação com o
 * período anterior (setinha e variação percentual).
 */
function Card({ titulo, valor, subtitulo, variacao, cor = '#1a3a5c' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-1 min-w-0">
      <span className="text-[0.68rem] font-semibold uppercase text-gray-500 tracking-wide">
        {titulo}
      </span>
      <span className="text-2xl font-bold" style={{ color: cor }}>
        {valor ?? '—'}
      </span>
      {subtitulo && (
        <span className="text-xs text-gray-500">{subtitulo}</span>
      )}
      {variacao !== undefined && variacao !== null && (
        <Variacao valor={variacao} />
      )}
    </div>
  )
}

function Variacao({ valor }) {
  if (valor === 0) {
    return <span className="text-xs text-gray-400">— sem variação</span>
  }
  const positivo = valor > 0
  const cor = positivo ? 'text-emerald-600' : 'text-rose-600'
  const seta = positivo ? '↑' : '↓'
  return (
    <span className={`text-xs font-medium ${cor}`}>
      {seta} {Math.abs(valor).toFixed(1)}% vs. período anterior
    </span>
  )
}

export default function CardResumo({ resumo }) {
  if (!resumo) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-lg p-4 h-24 animate-pulse"
          />
        ))}
      </div>
    )
  }

  const variacaoRecebidas = calcularVariacao(
    resumo.amostras_recebidas,
    resumo.amostras_recebidas_anterior,
  )

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
      <Card
        titulo="Amostras recebidas"
        valor={resumo.amostras_recebidas}
        subtitulo={`média ${resumo.media_diaria_recebimento}/dia`}
        variacao={variacaoRecebidas}
      />
      <Card
        titulo="Resultados liberados"
        valor={resumo.resultados_liberados}
        subtitulo={
          resumo.resultados_liberados > 0
            ? `${resumo.positivos} positivos`
            : 'nenhum no período'
        }
        cor="#198754"
      />
      <Card
        titulo="Positividade"
        valor={`${resumo.taxa_positividade_pct}%`}
        subtitulo={`${resumo.positivos} de ${resumo.resultados_liberados}`}
        cor="#b45309"
      />
      <Card
        titulo="Inválidos"
        valor={`${resumo.taxa_invalidos_pct}%`}
        subtitulo={`${resumo.invalidos} resultados`}
        cor={resumo.taxa_invalidos_pct > 10 ? '#dc2626' : '#6b7280'}
      />
      <Card
        titulo="Aguardando"
        valor={resumo.aguardando_total}
        subtitulo="em algum estágio"
        cor="#0891b2"
      />
      <Card
        titulo="TAT médio"
        valor={
          resumo.tat_medio_horas
            ? `${formatarHoras(resumo.tat_medio_horas)}`
            : '—'
        }
        subtitulo="recebimento → liberação"
        cor="#6f42c1"
      />
    </div>
  )
}

function calcularVariacao(atual, anterior) {
  if (!anterior) return null
  return ((atual - anterior) / anterior) * 100
}

function formatarHoras(h) {
  if (h < 24) return `${h.toFixed(1)}h`
  const dias = Math.floor(h / 24)
  const horas = Math.round(h - dias * 24)
  return `${dias}d ${horas}h`
}
