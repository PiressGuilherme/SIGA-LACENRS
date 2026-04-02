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
    <div style={{
      display: 'flex',
      gap: '0.75rem',
      marginBottom: '1.5rem',
      flexWrap: 'wrap',
      alignItems: 'center'
    }}>
      {/* Botão Início */}
      <button
        onClick={() => window.location.href = '/'}
        style={btnStyle('#6b7280')}
        title="Voltar à página inicial"
      >
        Início
      </button>

      {/* Botão Anterior */}
      {etapa.anterior && (
        <button
          onClick={() => window.location.href = etapa.anterior.path}
          style={btnStyle('#1a3a5c')}
          title={etapa.anterior.label}
        >
          ← {etapa.anterior.label}
        </button>
      )}

      {/* Botão Próxima Etapa */}
      {etapa.proxima && (
        <button
          onClick={() => window.location.href = etapa.proxima.path}
          style={btnStyle('#065f46')}
          title={etapa.proxima.label}
        >
          {etapa.proxima.label} →
        </button>
      )}

      {/* Indicador de etapa atual */}
      <span style={{
        marginLeft: 'auto',
        fontSize: '0.85rem',
        color: '#6b7280',
        fontWeight: 500
      }}>
        Etapa: <strong style={{ color: '#1a3a5c' }}>{etapa.label}</strong>
      </span>
    </div>
  )
}

function btnStyle(bg) {
  return {
    background: bg,
    color: '#fff',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
    transition: 'opacity 0.15s'
  }
}