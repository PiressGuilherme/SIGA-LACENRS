/**
 * CrachaModal — modal bloqueante de identificação por crachá.
 * Usa ui/dialog (Radix UI) para trap de foco, ESC e animação de entrada.
 */
import { useState, useRef, useEffect } from 'react'
import { ScanLine, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from './ui/dialog'

export default function CrachaModal({
  onValidado,
  modulo = '',
  operadorAtual = null,
  onManter,
  gruposRequeridos = [],
}) {
  const [codigo, setCodigo]         = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro]             = useState(null)
  const inputRef = useRef()

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 150)
  }, [])

  function handleCancelar() {
    window.location.href = '/'
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const val = codigo.trim()
    if (!val || carregando) return

    setCarregando(true)
    setErro(null)

    try {
      const token = localStorage.getItem('access_token')
      const params = new URLSearchParams({ codigo: val })
      if (gruposRequeridos.length) params.set('grupos', gruposRequeridos.join(','))

      const res = await fetch(`/api/auth/validar-cracha/?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'same-origin',
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) throw new Error(data.erro || 'Crachá não reconhecido.')

      if (data.access && data.refresh && data.usuario) {
        localStorage.setItem('access_token', data.access)
        localStorage.setItem('refresh_token', data.refresh)
        localStorage.setItem('usuario', JSON.stringify(data.usuario))
        const elHeader = document.getElementById('header-usuario')
        if (elHeader) elHeader.textContent = data.usuario.nome_completo
      }

      onValidado({ id: data.id, nome_completo: data.nome_completo, perfil: data.perfil, numero_cracha: val })
    } catch (err) {
      setErro(err.message)
      setCodigo('')
      setTimeout(() => inputRef.current?.focus(), 50)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <Dialog open modal>
      <DialogContent showClose={false}>
        <DialogHeader
          icon={<ScanLine className="inline-block w-10 h-10" />}
          title="Identificação do Operador"
          subtitle="Escaneie ou digite o código do crachá para iniciar."
          module={modulo}
        />

        <DialogBody>
          {erro && (
            <div className="flex items-center gap-2 bg-danger-100 text-danger-800 rounded-lg px-3.5 py-2.5 text-sm mb-4">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {erro}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
              placeholder="Escanear crachá..."
              disabled={carregando}
              autoComplete="off"
              className="w-full px-3.5 py-3 rounded-lg border-2 border-neutral-300 text-base text-center tracking-wider mb-3 outline-none transition-colors focus:border-rs-red box-border"
            />
            <button
              type="submit"
              disabled={carregando || !codigo.trim()}
              className="w-full py-3 bg-rs-red text-white border-none rounded-lg text-[0.95rem] font-bold cursor-pointer transition-opacity disabled:opacity-60 disabled:cursor-default hover:enabled:bg-danger-700"
            >
              {carregando ? 'Validando...' : 'Validar crachá'}
            </button>
          </form>

          {operadorAtual && onManter && (
            <div className="mt-4">
              <div className="text-center mb-3">
                <span className="text-[0.8rem] text-neutral-400">ou</span>
              </div>
              <button
                onClick={onManter}
                className="w-full py-2.5 bg-success-50 text-success-800 border-2 border-success-400 rounded-lg text-[0.88rem] font-medium cursor-pointer transition-colors hover:bg-success-100"
              >
                Continuar como <strong>{operadorAtual.nome_completo}</strong>
              </button>
            </div>
          )}

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleCancelar}
              className="text-neutral-500 text-[0.85rem] cursor-pointer py-2 px-4 underline bg-transparent border-none transition-colors hover:text-neutral-700"
            >
              Cancelar e voltar ao início
            </button>
          </div>
        </DialogBody>

        <DialogFooter>SIGA-LACEN · Laboratório de HPV</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
