import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

/**
 * Input — campo de texto padronizado.
 *
 * Props:
 *   label        — texto do label (opcional)
 *   error        — mensagem de erro (opcional, adiciona borda vermelha)
 *   hint         — texto de ajuda abaixo do input
 *   leftIcon     — elemento React para ícone à esquerda
 *   rightIcon    — elemento React para ícone à direita
 */
const Input = forwardRef(function Input(
  { label, error, hint, leftIcon, rightIcon, className, id, ...props },
  ref
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-neutral-700 mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-lg border bg-white text-sm text-neutral-900 placeholder-neutral-400',
            'px-3.5 py-2.5 outline-none transition-colors',
            'focus:border-rs-red focus:ring-1 focus:ring-rs-red',
            'disabled:bg-neutral-50 disabled:text-neutral-400 disabled:cursor-not-allowed',
            error
              ? 'border-danger-500 focus:border-danger-600 focus:ring-danger-200'
              : 'border-neutral-300',
            leftIcon && 'pl-9',
            rightIcon && 'pr-9',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-neutral-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-xs text-danger-700">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${inputId}-hint`} className="mt-1 text-xs text-neutral-500">
          {hint}
        </p>
      )}
    </div>
  )
})

export { Input }
export default Input
