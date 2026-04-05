/**
 * NavigationButtons — Botões de navegação para o fluxo do laboratório
 * 
 * Props:
 *   currentStep — Etapa atual do fluxo (aliquotagem, extracao, pcr, resultados)
 */

const FLUXO = {
  aliquotagem: {
    label: 'Aliquotagem',
    path: '/amostras/aliquotagem/',
    proxima: { label: 'Ir para Extração', path: '/placas/extracao/' }
  },
  extracao: {
    label: 'Extração',
    path: '/placas/extracao/',
    anterior: { label: 'Voltar para Aliquotagem', path: '/amostras/aliquotagem/' },
    proxima: { label: 'Ir para PCR', path: '/placas/pcr/' }
  },
  pcr: {
    label: 'PCR',
    path: '/placas/pcr/',
    anterior: { label: 'Voltar para Extração', path: '/placas/extracao/' },
    proxima: { label: 'Ir para Resultados', path: '/resultados/revisar/' }
  },
  resultados: {
    label: 'Resultados',
    path: '/resultados/revisar/',
    anterior: { label: 'Voltar para PCR', path: '/placas/pcr/' }
  },
  consulta: {
    label: 'Consulta',
    path: '/amostras/consulta/'
  },
  importar: {
    label: 'Importar CSV',
    path: '/amostras/importar/'
  }
}

export default function NavigationButtons({ currentStep }) {
  const etapa = FLUXO[currentStep]

  if (!etapa) return null

  return (
    <div className="flex gap-3 mb-6 flex-wrap items-center">
      {/* Botão Início */}
      <button
        onClick={() => window.location.href = '/'}
        className="bg-neutral-500 text-white border-none px-4 py-2 rounded-md cursor-pointer text-[0.85rem] font-medium transition-opacity hover:opacity-80"
        title="Voltar à página inicial"
      >
        Início
      </button>

      {/* Botão Anterior */}
      {etapa.anterior && (
        <button
          onClick={() => window.location.href = etapa.anterior.path}
          className="bg-neutral-700 text-white border-none px-4 py-2 rounded-md cursor-pointer text-[0.85rem] font-medium transition-opacity hover:opacity-80"
          title={etapa.anterior.label}
        >
          ← {etapa.anterior.label}
        </button>
      )}

      {/* Botão Próxima Etapa */}
      {etapa.proxima && (
        <button
          onClick={() => window.location.href = etapa.proxima.path}
          className="bg-success-800 text-white border-none px-4 py-2 rounded-md cursor-pointer text-[0.85rem] font-medium transition-opacity hover:opacity-80"
          title={etapa.proxima.label}
        >
          {etapa.proxima.label} →
        </button>
      )}

      {/* Indicador de etapa atual */}
      <span className="ml-auto text-[0.85rem] text-neutral-500 font-medium">
        Etapa: <strong className="text-rs-red">{etapa.label}</strong>
      </span>
    </div>
  )
}