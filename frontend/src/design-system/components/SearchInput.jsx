/**
 * SearchInput — Campo de busca com debounce e ícone de lupa.
 */
import { useState, useEffect, useRef } from 'react'

export default function SearchInput({
  onSearch,
  debounceMs = 300,
  placeholder = 'Buscar...',
  value: controlledValue,
  onChange,
  className = '',
}) {
  const [internalValue, setInternalValue] = useState('')
  const timerRef = useRef()

  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue

  function handleChange(e) {
    const newValue = e.target.value
    if (!isControlled) setInternalValue(newValue)
    if (onChange) onChange(newValue)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (onSearch) onSearch(newValue)
    }, debounceMs)
  }

  function handleClear() {
    if (!isControlled) setInternalValue('')
    if (onChange) onChange('')
    if (onSearch) onSearch('')
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div className={`relative ${className}`}>
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>

      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2 text-[0.9rem] border border-neutral-300 rounded-lg outline-none bg-white transition-colors focus:border-rs-red focus:ring-1 focus:ring-danger-100"
      />

      {value && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors"
          title="Limpar busca"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
