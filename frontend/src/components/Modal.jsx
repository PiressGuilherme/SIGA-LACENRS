/**
 * Modal — overlay fullscreen reutilizável.
 *
 * Props:
 *   open        — Boolean. Se false, nada é renderizado.
 *   onClose     — Chamado ao clicar no backdrop ou pressionar Esc.
 *   title       — Título do modal (string ou ReactNode).
 *   children    — Conteúdo do corpo.
 *   footer      — Conteúdo do rodapé (geralmente botões).
 *   width       — Classes Tailwind de largura (default: 'max-w-md').
 *   closeOnBackdrop — Boolean (default true).
 */
import { useEffect } from 'react'

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-md',
  closeOnBackdrop = true,
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-lg shadow-xl w-full ${width} overflow-hidden`}
      >
        {title && (
          <div className="px-5 py-3 border-b border-gray-200 text-base font-semibold text-blue-900">
            {title}
          </div>
        )}
        <div className="px-5 py-4 text-sm text-gray-700">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex gap-2 justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
