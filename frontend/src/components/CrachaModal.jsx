/**
 * CrachaModal — modal bloqueante de identificação por crachá.
 *
 * Exibido como overlay fullscreen que impede interação com a página
 * até que o operador escaneie um crachá válido.
 *
 * Props:
 *   onValidado(user)   chamado após validação bem-sucedida
 *   modulo             nome do módulo exibido no título (ex: 'Aliquotagem')
 *   operadorAtual      se preenchido, exibe opção de manter operador
 *   onManter()         chamado quando operador decide manter o anterior
 */
import { useState, useRef, useEffect } from 'react'

export default function CrachaModal({ onValidado, modulo = '', operadorAtual = null, onManter, gruposRequeridos = [] }) {
  const [codigo, setCodigo]       = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro]           = useState(null)
  const inputRef = useRef()

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
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

      if (!res.ok) {
        throw new Error(data.erro || 'Crachá não reconhecido.')
      }

      // Switch de sessão: atualiza tokens e identidade no localStorage
      if (data.access && data.refresh && data.usuario) {
        localStorage.setItem('access_token', data.access)
        localStorage.setItem('refresh_token', data.refresh)
        localStorage.setItem('usuario', JSON.stringify(data.usuario))

        // Atualiza o nome do operador no header da página
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
    <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-[9999] backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl overflow-hidden w-full max-w-[420px] mx-4">
        {/* Header */}
        <div className="bg-brand-800 px-8 pt-7 pb-5 text-center text-white">
          <div className="text-[2.8rem] mb-1">ID</div>
          <div className="text-[1.2rem] font-bold tracking-wide">Identificação do Operador</div>
          {modulo && (
            <div className="text-[0.8rem] text-brand-300 mt-1">Módulo: {modulo}</div>
          )}
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          <p className="text-[0.88rem] text-neutral-500 text-center mb-5 leading-relaxed">
            Escaneie ou digite o código do crachá para iniciar.
          </p>

          {erro && (
            <div className="bg-danger-100 text-danger-800 rounded-lg px-3.5 py-2.5 text-[0.85rem] text-center mb-4">
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
              className="w-full px-3.5 py-3 rounded-lg border-2 border-neutral-300 text-base text-center tracking-wider mb-3 outline-none transition-colors focus:border-brand-500 box-border"
            />
            <button
              type="submit"
              disabled={carregando || !codigo.trim()}
              className={`w-full py-3 bg-brand-800 text-white border-none rounded-lg text-[0.95rem] font-bold cursor-pointer transition-opacity ${(carregando || !codigo.trim()) ? 'opacity-60 cursor-default' : 'hover:bg-brand-700'}`}
            >
              {carregando ? 'Validando...' : 'Validar crachá'}
            </button>
          </form>

          {/* Manter operador anterior */}
          {operadorAtual && onManter && (
            <div className="mt-4">
              <div className="text-center relative mb-3">
                <span className="bg-white px-3 text-[0.8rem] text-neutral-400 relative z-[1]">ou</span>
              </div>
              <button onClick={onManter} className="w-full py-2.5 bg-success-50 text-success-800 border-2 border-success-400 rounded-lg text-[0.88rem] font-medium cursor-pointer transition-colors hover:bg-success-100">
                Continuar como <strong>{operadorAtual.nome_completo}</strong>
              </button>
            </div>
          )}

          {/* Botão cancelar */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleCancelar}
              className="bg-none border-none text-neutral-500 text-[0.85rem] cursor-pointer py-2 px-4 underline transition-colors hover:text-neutral-700"
            >
              Cancelar e voltar ao início
            </button>
          </div>
        </div>

        <div className="text-center py-3 text-[0.7rem] text-neutral-400 border-t border-neutral-100">
          SIGA-LACEN · Laboratório de HPV
        </div>
      </div>
    </div>
  )
}