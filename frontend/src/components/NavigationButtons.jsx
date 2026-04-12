/**
 * NavigationButtons — Botões de navegação para o fluxo do laboratório
 *
 * Props:
 *   currentStep — Etapa atual do fluxo (aliquotagem, extracao, pcr, resultados)
 */

import Button from './Button'

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

// Ícones SVG inline — sem dependência externa
const IconHome = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)

const IconArrowLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </svg>
)

const IconArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
)

export default function NavigationButtons({ currentStep }) {
  const etapa = FLUXO[currentStep]

  if (!etapa) return null

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">

      {/* Início */}
      <Button
        variant="ghost"
        size="sm"
        icon={<IconHome />}
        onClick={() => window.location.href = '/'}
        title="Voltar à página inicial"
      >
        Início
      </Button>

      {/* Etapa anterior */}
      {etapa.anterior && (
        <Button
          variant="ghost"
          size="sm"
          icon={<IconArrowLeft />}
          onClick={() => window.location.href = etapa.anterior.path}
          title={etapa.anterior.label}
        >
          {etapa.anterior.label}
        </Button>
      )}

      {/* Próxima etapa */}
      {etapa.proxima && (
        <Button
          variant="secondary"
          size="sm"
          iconRight={<IconArrowRight />}
          onClick={() => window.location.href = etapa.proxima.path}
          title={etapa.proxima.label}
        >
          {etapa.proxima.label}
        </Button>
      )}

      {/* Indicador de etapa atual */}
      <span className="ml-auto text-sm text-gray-400 font-medium">
        Etapa: <strong className="text-[#1a3a5c]">{etapa.label}</strong>
      </span>

    </div>
  )
}
