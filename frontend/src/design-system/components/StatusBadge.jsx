/**
 * StatusBadge — Badge de status do workflow HPV
 * 
 * Substitui os objetos STATUS_BADGE duplicados em cada página.
 * Variantes: default (pill outline), filled, dot
 */

import { STATUS_CONFIG } from '../tokens.js'

const colorClasses = {
  neutral: {
    default: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    filled: 'bg-neutral-600 text-white',
    dot: 'text-neutral-700',
  },
  info: {
    default: 'bg-info-100 text-info-700 border-info-200',
    filled: 'bg-info-500 text-white',
    dot: 'text-info-700',
  },
  brand: {
    default: 'bg-brand-100 text-brand-700 border-brand-200',
    filled: 'bg-brand-600 text-white',
    dot: 'text-brand-700',
  },
  warning: {
    default: 'bg-warning-100 text-warning-700 border-warning-200',
    filled: 'bg-warning-600 text-white',
    dot: 'text-warning-700',
  },
  danger: {
    default: 'bg-danger-100 text-danger-700 border-danger-200',
    filled: 'bg-danger-600 text-white',
    dot: 'text-danger-700',
  },
  success: {
    default: 'bg-success-100 text-success-700 border-success-200',
    filled: 'bg-success-600 text-white',
    dot: 'text-success-700',
  },
  processing: {
    default: 'bg-processing-100 text-processing-700 border-processing-200',
    filled: 'bg-processing-500 text-white',
    dot: 'text-processing-700',
  },
}

const dotColors = {
  neutral: 'bg-neutral-400',
  info: 'bg-info-500',
  brand: 'bg-brand-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  success: 'bg-success-500',
  processing: 'bg-processing-500',
}

export default function StatusBadge({
  status,
  variant = 'default',
  className = '',
}) {
  const config = STATUS_CONFIG[status]
  
  if (!config) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-700 ${className}`}>
        {status}
      </span>
    )
  }

  const colorName = config.color
  const colors = colorClasses[colorName] || colorClasses.neutral
  const colorClass = colors[variant] || colors.default

  if (variant === 'dot') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${colors.dot} ${className}`}>
        <span className={`h-2 w-2 rounded-full ${dotColors[colorName] || dotColors.neutral}`} />
        {config.label}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${colorClass} ${className}`}>
      {config.label}
    </span>
  )
}