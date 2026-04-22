/**
 * Gráfico de recebimento de amostras ao longo do tempo.
 *
 * Duas séries sobrepostas: total recebido (barras) e canceladas (linha),
 * para que o frontend mostre o volume real e destaque o impacto dos
 * cancelamentos no fluxo.
 */
import { useEffect, useRef } from 'react'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Chart } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
)

function formatarData(iso, bucket) {
  const d = new Date(iso)
  if (bucket === 'week') {
    return `semana ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function GraficoRecebimento({ dados }) {
  const chartRef = useRef(null)

  if (!dados) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 h-80 animate-pulse" />
    )
  }

  if (dados.buckets.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center h-80 text-gray-400">
        <span className="text-4xl mb-2">📊</span>
        <p className="text-sm">Nenhuma amostra recebida no período.</p>
      </div>
    )
  }

  const labels = dados.buckets.map((b) => formatarData(b.data, dados.bucket))
  const validas = dados.buckets.map((b) => b.validas)
  const canceladas = dados.buckets.map((b) => b.canceladas)

  const data = {
    labels,
    datasets: [
      {
        type: 'bar',
        label: 'Válidas',
        data: validas,
        backgroundColor: '#1a3a5c',
        borderColor: '#1a3a5c',
        stack: 'amostras',
        borderRadius: 4,
      },
      {
        type: 'bar',
        label: 'Canceladas',
        data: canceladas,
        backgroundColor: '#dc2626',
        borderColor: '#dc2626',
        stack: 'amostras',
        borderRadius: 4,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12 } },
      tooltip: {
        callbacks: {
          footer: (items) => {
            const total = items.reduce((acc, it) => acc + it.parsed.y, 0)
            return `Total: ${total}`
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        grid: { color: '#f3f4f6' },
      },
    },
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-gray-800">Recebimento de amostras</h3>
        <div className="text-xs text-gray-500 flex gap-3">
          <span>Total: <b className="text-gray-800">{dados.total}</b></span>
          <span>Canceladas: <b className="text-rose-600">{dados.canceladas}</b></span>
          <span>Média diária: <b className="text-gray-800">{dados.media_diaria}</b></span>
          <span>Média semanal: <b className="text-gray-800">{dados.media_semanal}</b></span>
        </div>
      </div>
      <div className="h-72">
        <Chart ref={chartRef} type="bar" data={data} options={options} />
      </div>
    </div>
  )
}
