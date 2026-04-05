/**
 * StatusBadge — Badge de status do workflow HPV
 */

import { STATUS_CONFIG } from '../tokens.js'

const colorClasses = {
  neutral: {
    default: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    filled:  'bg-neutral-600 text-white',
    dot:     'text-neutral-700',
  },
  // info substituído por âmbar claro — sem azul na UI
  info: {
    default: 'bg-warning-100 text-warning-700 border-warning-200',
    filled:  'bg-warning-500 text-white',
    dot:     'text-warning-700',
  },
  // brand substituído por vermelho RS
  brand: {
    default: 'bg-danger-100 text-rs-red border-danger-200',
    filled:  'bg-rs-red text-white',
    dot:     'text-rs-red',
  },
  warning: {
    default: 'bg-warning-100 text-warning-700 border-warning-200',
    filled:  'bg-warning-600 text-white',
    dot:     'text-warning-700',
  },
  danger: {
    default: 'bg-danger-100 text-danger-700 border-danger-200',
    filled:  'bg-danger-600 text-white',
    dot:     'text-danger-700',
  },
  success: {
    default: 'bg-success-100 text-success-700 border-success-200',
    filled:  'bg-success-600 text-white',
    dot:     'text-success-700',
  },
  processing: {
    default: 'bg-processing-100 text-processing-700 border-processing-200',
    filled:  'bg-processing-500 text-white',
    dot:     'text-processing-700',
  },
}

const dotColors = {
  neutral:    'bg-neutral-400',
  info:       'bg-warning-500',
  brand:      'bg-rs-red',
  warning:    'bg-warning-500',
  danger:     'bg-danger-500',
  success:    'bg-success-500',
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
