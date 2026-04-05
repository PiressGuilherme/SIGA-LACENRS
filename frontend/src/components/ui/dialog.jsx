import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

// ── Primitivos re-exportados ──────────────────────────────────────────────────
export const Dialog        = RadixDialog.Root
export const DialogTrigger = RadixDialog.Trigger
export const DialogClose   = RadixDialog.Close

// ── Overlay ───────────────────────────────────────────────────────────────────
export function DialogOverlay({ className, ...props }) {
  return (
    <RadixDialog.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-black/55 backdrop-blur-sm',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  )
}

// ── Content ───────────────────────────────────────────────────────────────────
export function DialogContent({ className, children, showClose = true, ...props }) {
  return (
    <RadixDialog.Portal>
      <DialogOverlay />
      <RadixDialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-[440px] mx-4 bg-white rounded-xl shadow-xl overflow-hidden',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
          'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
          'duration-150',
          className
        )}
        {...props}
      >
        {children}
        {showClose && (
          <RadixDialog.Close className="absolute right-4 top-4 rounded-md p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors focus:outline-none focus:ring-2 focus:ring-rs-red">
            <X className="h-4 w-4" />
          </RadixDialog.Close>
        )}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  )
}

// ── Header vermelho RS com faixa tricolor ─────────────────────────────────────
export function DialogHeader({ icon, title, subtitle, module: modulo }) {
  return (
    <>
      <div className="bg-rs-red px-8 pt-7 pb-5 text-center text-white">
        {icon && <div className="text-[2.8rem] mb-1 leading-none">{icon}</div>}
        <div className="text-[1.15rem] font-bold tracking-wide">{title}</div>
        {subtitle && <div className="text-[0.82rem] text-red-200 mt-1">{subtitle}</div>}
        {modulo && <div className="text-[0.78rem] text-red-300 mt-0.5">Módulo: {modulo}</div>}
      </div>
      {/* Faixa tricolor RS */}
      <div className="h-1 flex">
        <div className="flex-1 bg-rs-red" />
        <div className="flex-1 bg-rs-yellow" />
        <div className="flex-1 bg-rs-green" />
      </div>
    </>
  )
}

// ── Body ──────────────────────────────────────────────────────────────────────
export function DialogBody({ className, children }) {
  return (
    <div className={cn('px-8 py-6', className)}>
      {children}
    </div>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────
export function DialogFooter({ className, children }) {
  return (
    <div className={cn('text-center py-3 text-[0.7rem] text-neutral-400 border-t border-neutral-100', className)}>
      {children}
    </div>
  )
}

// ── ConfirmDialog stand-alone ─────────────────────────────────────────────────
/**
 * ConfirmDialog — modal de confirmação com título, mensagem e botões.
 *
 * Props:
 *   open, onOpenChange — estado externo
 *   title, message     — texto do modal
 *   confirmLabel       — texto do botão de confirmação (default: "Confirmar")
 *   cancelLabel        — texto do botão cancelar (default: "Cancelar")
 *   variant            — "danger" | "primary" | "warning" (cor do botão confirmar)
 *   onConfirm          — callback ao confirmar
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title = 'Confirmar ação',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
}) {
  const confirmStyles = {
    danger:  'bg-danger-600 hover:bg-danger-700 text-white',
    primary: 'bg-rs-red hover:bg-danger-700 text-white',
    warning: 'bg-warning-500 hover:bg-warning-600 text-white',
  }[variant] ?? 'bg-rs-red hover:bg-danger-700 text-white'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={false} className="max-w-sm">
        <div className="px-6 pt-6 pb-4">
          <RadixDialog.Title className="text-base font-semibold text-neutral-900 mb-2">
            {title}
          </RadixDialog.Title>
          {message && (
            <RadixDialog.Description className="text-sm text-neutral-600 leading-relaxed">
              {message}
            </RadixDialog.Description>
          )}
        </div>
        <div className="flex gap-2 px-6 pb-5">
          <DialogClose asChild>
            <button className="flex-1 py-2 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors focus:outline-none focus:ring-2 focus:ring-rs-red">
              {cancelLabel}
            </button>
          </DialogClose>
          <button
            onClick={() => { onConfirm?.(); onOpenChange?.(false) }}
            className={cn('flex-1 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-rs-red', confirmStyles)}
          >
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
