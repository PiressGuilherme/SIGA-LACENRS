/**
 * BarcodeInput — Input especializado para scan de crachá e código de amostra
 */

import { useRef, useEffect } from 'react'

export default function BarcodeInput({
  label,
  placeholder = 'Escanear ou digitar...',
  onSubmit,
  loading = false,
  disabled = false,
  value,
  onChange,
  autoFocus = true,
  className = '',
  ...props
}) {
  const inputRef = useRef()

  useEffect(() => {
    if (autoFocus && !loading && !disabled) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [loading, disabled, autoFocus])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault()
      onSubmit(value)
    }
  }

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange?.(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || loading}
        autoComplete="off"
        className={`
          w-full px-4 py-3
          font-mono text-lg text-center tracking-wider
          border-2 border-rs-red rounded-lg
          bg-white text-neutral-900
          placeholder:text-neutral-400 placeholder:font-sans placeholder:text-base placeholder:tracking-normal
          focus:outline-none focus:border-danger-700 focus:ring-2 focus:ring-danger-100
          disabled:bg-neutral-100 disabled:text-neutral-500 disabled:border-neutral-300
          transition-colors
        `}
        {...props}
      />
    </div>
  )
}
