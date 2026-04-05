import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

// Paleta por família de cor semântica
const PALETTE = {
  neutral:    { soft: 'bg-neutral-100 text-neutral-700 border-neutral-300',    filled: 'bg-neutral-600 text-white' },
  info:       { soft: 'bg-warning-100 text-warning-700 border-warning-300',    filled: 'bg-warning-600 text-white' },
  brand:      { soft: 'bg-danger-100 text-rs-red border-danger-200',           filled: 'bg-rs-red text-white' },
  warning:    { soft: 'bg-warning-100 text-warning-700 border-warning-300',    filled: 'bg-warning-600 text-white' },
  danger:     { soft: 'bg-danger-100 text-danger-700 border-danger-300',       filled: 'bg-danger-600 text-white' },
  success:    { soft: 'bg-success-100 text-success-700 border-success-300',    filled: 'bg-success-700 text-white' },
  processing: { soft: 'bg-processing-100 text-processing-700 border-processing-100', filled: 'bg-processing-700 text-white' },
}

// Mapa de status do workflow
const STATUS_CONFIG = {
  aguardando_triagem:   { label: 'Aguardando Triagem', color: 'neutral' },
  exame_em_analise:     { label: 'Em Análise',         color: 'info' },
  aliquotada:           { label: 'Aliquotada',         color: 'brand' },
  extracao:             { label: 'Em Extração',        color: 'warning' },
  extraida:             { label: 'Extraída',           color: 'processing' },
  pcr:                  { label: 'Em PCR',             color: 'processing' },
  resultado:            { label: 'Resultado',          color: 'success' },
  resultado_liberado:   { label: 'Liberado',           color: 'success' },
  cancelada:            { label: 'Cancelada',          color: 'danger' },
  repeticao_solicitada: { label: 'Repetição',          color: 'warning' },
}

/**
 * Badge — exibe status do workflow ou qualquer label colorido.
 *
 * Props:
 *   status  — chave do STATUS_CONFIG (ex: "aliquotada"). Se passado, usa label e cor automáticos.
 *   color   — família semântica manual ("success", "danger", etc.) se não usar status
 *   label   — texto manual se não usar status
 *   variant — "soft" (fundo claro, borda) | "filled" (fundo sólido) | "dot" (bolinha + texto)
 */
export default function Badge({ status, color, label, variant = 'soft', className }) {
  const config = status ? STATUS_CONFIG[status] : null
  const resolvedColor = config?.color ?? color ?? 'neutral'
  const resolvedLabel = config?.label ?? label ?? status ?? '—'
  const palette = PALETTE[resolvedColor] ?? PALETTE.neutral

  if (variant === 'dot') {
    const dotColor = {
      neutral: 'bg-neutral-400',
      info: 'bg-warning-500',
      brand: 'bg-rs-red',
      warning: 'bg-warning-500',
      danger: 'bg-danger-600',
      success: 'bg-success-500',
      processing: 'bg-processing-500',
    }[resolvedColor] ?? 'bg-neutral-400'

    return (
      <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700', className)}>
        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', dotColor)} />
        {resolvedLabel}
      </span>
    )
  }

  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border',
      variant === 'filled' ? palette.filled + ' border-transparent' : palette.soft,
      className
    )}>
      {resolvedLabel}
    </span>
  )
}
