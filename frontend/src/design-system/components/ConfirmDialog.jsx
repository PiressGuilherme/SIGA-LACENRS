/**
 * ConfirmDialog — modal de confirmação baseado em Radix Dialog.
 * API compatível com o componente anterior.
 */
import { Dialog, DialogContent, ConfirmDialog as RadixConfirmDialog } from '../../components/ui/dialog'
import * as RadixDialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '../../lib/utils'

export default function ConfirmDialog({
  open,
  title,
  description,       // prop legada
  message,           // prop nova (sinônimo de description)
  confirmLabel = 'Confirmar',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,          // prop legada
  onOpenChange,      // prop nova
  loading = false,
}) {
  const resolvedMessage = description ?? message
  const handleOpenChange = (v) => {
    if (!v) {
      onCancel?.()
      onOpenChange?.(false)
    }
  }

  const confirmStyles = {
    danger:  'bg-danger-600 hover:bg-danger-700 text-white',
    primary: 'bg-rs-red hover:bg-danger-700 text-white',
    warning: 'bg-warning-500 hover:bg-warning-600 text-white',
  }[confirmVariant] ?? 'bg-danger-600 hover:bg-danger-700 text-white'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showClose={false} className="max-w-sm">
        <div className="px-6 pt-6 pb-4">
          <RadixDialogPrimitive.Title className="text-base font-semibold text-neutral-900 mb-2">
            {title}
          </RadixDialogPrimitive.Title>
          {resolvedMessage && (
            <RadixDialogPrimitive.Description className="text-sm text-neutral-600 leading-relaxed">
              {resolvedMessage}
            </RadixDialogPrimitive.Description>
          )}
        </div>
        <div className="flex gap-2 px-6 pb-5">
          <button
            onClick={() => handleOpenChange(false)}
            disabled={loading}
            className="flex-1 py-2 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors focus:outline-none focus:ring-2 focus:ring-rs-red disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => { onConfirm?.(); handleOpenChange(false) }}
            disabled={loading}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-semibold transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-rs-red',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              confirmStyles
            )}
          >
            {loading ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
