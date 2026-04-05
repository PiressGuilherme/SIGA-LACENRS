/**
 * CrachaInput — validação de crachá por leitura ou digitação.
 */
import { useState, useRef, useEffect } from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

export default function CrachaInput({ onValidado, label = 'Identificação do Operador' }) {
  const [codigo, setCodigo]         = useState('')
  const [operador, setOperador]     = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro]             = useState(null)
  const inputRef = useRef()

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    const val = codigo.trim()
    if (!val || carregando) return

    setCarregando(true)
    setErro(null)

    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`/api/auth/validar-cracha/?codigo=${encodeURIComponent(val)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'same-origin',
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.erro || 'Crachá não reconhecido.')
      }

      const novoOperador = { ...data, numero_cracha: val }
      setOperador(novoOperador)
      onValidado(novoOperador)
    } catch (err) {
      setErro(err.message)
    } finally {
      setCodigo('')
      setCarregando(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return (
    <div className={`rounded-lg px-4 py-3.5 mb-5 transition-colors border ${operador ? 'bg-success-50 border-success-400' : 'bg-neutral-50 border-neutral-200'}`}>
      <div className="text-[0.78rem] font-semibold text-neutral-600 mb-2 uppercase tracking-wider">
        {label}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input
          ref={inputRef}
          type="text"
          value={codigo}
          onChange={e => setCodigo(e.target.value)}
          placeholder="Escaneie ou digite o código do crachá..."
          disabled={carregando}
          autoComplete="off"
          className="flex-1 px-3 py-2 text-[0.95rem] border-2 border-neutral-300 rounded-md outline-none bg-white focus:border-rs-red transition-colors"
        />
        <button
          type="submit"
          disabled={carregando || !codigo.trim()}
          className={`px-3.5 py-2 text-[0.85rem] font-semibold bg-rs-red text-white border-none rounded-md whitespace-nowrap transition-opacity ${(carregando || !codigo.trim()) ? 'cursor-default opacity-50' : 'cursor-pointer hover:bg-danger-700'}`}
        >
          {carregando ? '...' : 'Validar'}
        </button>
      </form>

      {operador && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[0.9rem] text-success-800 font-semibold flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" /> {operador.nome_completo}
          </span>
          <span className="text-[0.72rem] bg-success-100 text-success-800 px-1.5 py-0.5 rounded-full font-medium">
            {operador.perfil}
          </span>
          <span className="text-[0.75rem] text-neutral-500 ml-auto">
            Escaneie um novo crachá para trocar de operador
          </span>
        </div>
      )}

      {erro && (
        <div className="mt-1.5 text-[0.82rem] text-danger-700 flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" /> {erro}
        </div>
      )}
    </div>
  )
}
