/**
 * ConfirmDialog — Modal de confirmação para ações destrutivas
 */

import { useEffect, useRef } from 'react'

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
  loading = false,
}) {
  const confirmRef = useRef()

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => confirmRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [open])

  useEffect(() => {
    function handleKeyDown(e) {
      if (!open) return
      if (e.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  const confirmClasses = {
    danger: 'bg-danger-600 text-white hover:bg-danger-700 focus:ring-danger-500',
    primary: 'bg-rs-red text-white hover:bg-danger-700 focus:ring-rs-red',
    warning: 'bg-warning-600 text-white hover:bg-warning-700 focus:ring-warning-500',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onCancel?.() }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h3 className="text-lg font-bold text-neutral-900 mb-2">
            {title}
          </h3>
          <p className="text-sm text-neutral-600 leading-relaxed">
            {description}
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-rs-red focus:ring-offset-1 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={loading}
            className={`
              px-4 py-2 text-sm font-medium rounded-md
              focus:outline-none focus:ring-2 focus:ring-offset-1
              disabled:opacity-50 disabled:cursor-not-allowed
              ${confirmClasses[confirmVariant] || confirmClasses.danger}
            `}
          >
            {loading ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
