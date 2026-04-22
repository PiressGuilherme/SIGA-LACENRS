/**
 * Distribuição de resultados finais + tendência de positividade.
 *
 * Dois elementos:
 *   - Gráfico de rosca com a distribuição absoluta por tipo
 *   - Linha de positividade (%) ao longo do período
 */
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Doughnut, Line } from 'react-chartjs-2'

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
)

// Cores alinhadas com RESULTADO_BADGE do ConsultaAmostras (verde=negativo,
// âmbar=positivo, vermelho=inválido) para manter coerência visual.
const COR_RESULTADO = {
  hpv_nao_detectado: '#10b981',
  hpv16: '#f59e0b',
  hpv18: '#f59e0b',
  hpv_ar: '#f59e0b',
  hpv18_ar: '#ea580c',
  hpv16_ar: '#ea580c',
  hpv16_18: '#ea580c',
  hpv16_18_ar: '#b45309',
  invalido: '#dc2626',
  inconclusivo: '#9ca3af',
  pendente: '#d1d5db',
}

function formatarData(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function GraficoResultados({ dados }) {
  if (!dados) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6 h-80 animate-pulse" />
        <div className="bg-white border border-gray-200 rounded-lg p-6 h-80 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Distribuicao dados={dados} />
      <Tendencia dados={dados} />
    </div>
  )
}

function Distribuicao({ dados }) {
  if (dados.total === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
        <h3 className="font-semibold text-gray-800 mb-3">Distribuição de resultados</h3>
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <span className="text-4xl mb-2">🧬</span>
          <p className="text-sm">Nenhum resultado liberado no período.</p>
        </div>
      </div>
    )
  }

  const data = {
    labels: dados.distribuicao.map((d) => d.label),
    datasets: [
      {
        data: dados.distribuicao.map((d) => d.total),
        backgroundColor: dados.distribuicao.map(
          (d) => COR_RESULTADO[d.resultado] || '#6b7280',
        ),
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const d = dados.distribuicao[ctx.dataIndex]
            return ` ${d.label}: ${d.total} (${d.percentual}%)`
          },
        },
      },
    },
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-gray-800">Distribuição de resultados</h3>
        <span className="text-xs text-gray-500">
          total: <b className="text-gray-800">{dados.total}</b>
        </span>
      </div>
      <div className="h-64">
        <Doughnut data={data} options={options} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Metrica label="Positividade" valor={`${dados.taxa_positividade_pct}%`} cor="#b45309" />
        <Metrica label="Inválidos" valor={`${dados.taxa_invalidos_pct}%`} cor="#dc2626" />
        <Metrica label="Positivos" valor={dados.positivos} cor="#1f2937" />
      </div>
    </div>
  )
}

function Metrica({ label, valor, cor }) {
  return (
    <div className="bg-gray-50 rounded p-2">
      <div className="text-[0.65rem] uppercase text-gray-500 font-semibold">{label}</div>
      <div className="text-base font-bold" style={{ color: cor }}>{valor}</div>
    </div>
  )
}

function Tendencia({ dados }) {
  if (!dados.tendencia?.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Tendência de positividade</h3>
        <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
          Sem dados suficientes para exibir tendência.
        </div>
      </div>
    )
  }

  const data = {
    labels: dados.tendencia.map((t) => formatarData(t.data)),
    datasets: [
      {
        label: 'Positividade (%)',
        data: dados.tendencia.map((t) => t.taxa_positividade_pct),
        borderColor: '#b45309',
        backgroundColor: 'rgba(180, 83, 9, 0.15)',
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#b45309',
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterLabel: (ctx) => {
            const p = dados.tendencia[ctx.dataIndex]
            return `${p.positivos} de ${p.total}`
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        beginAtZero: true,
        max: 100,
        ticks: { callback: (v) => `${v}%` },
        grid: { color: '#f3f4f6' },
      },
    },
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="font-semibold text-gray-800 mb-3">Tendência de positividade</h3>
      <div className="h-64">
        <Line data={data} options={options} />
      </div>
    </div>
  )
}
