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
    <div style={s.overlay}>
      <div style={s.card}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.icon}>ID</div>
          <div style={s.title}>Identificação do Operador</div>
          {modulo && (
            <div style={s.subtitle}>Módulo: {modulo}</div>
          )}
        </div>

        {/* Body */}
        <div style={s.body}>
          <p style={s.hint}>
            Escaneie ou digite o código do crachá para iniciar.
          </p>

          {erro && (
            <div style={s.erro}>{erro}</div>
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
              style={s.input}
            />
            <button
              type="submit"
              disabled={carregando || !codigo.trim()}
              style={{
                ...s.btnPrimary,
                opacity: (carregando || !codigo.trim()) ? 0.6 : 1,
              }}
            >
              {carregando ? 'Validando...' : 'Validar crachá'}
            </button>
          </form>

          {/* Manter operador anterior */}
          {operadorAtual && onManter && (
            <div style={s.manterSection}>
              <div style={s.manterDivider}>
                <span style={s.manterDividerText}>ou</span>
              </div>
              <button onClick={onManter} style={s.btnManter}>
                Continuar como <strong>{operadorAtual.nome_completo}</strong>
              </button>
            </div>
          )}

          {/* Botão cancelar */}
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button
              type="button"
              onClick={handleCancelar}
              style={s.btnCancelar}
            >
              Cancelar e voltar ao início
            </button>
          </div>
        </div>

        <div style={s.footer}>
          SIGA-LACEN · Laboratório de HPV
        </div>
      </div>
    </div>
  )
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(3px)',
  },
  card: {
    background: '#fff',
    borderRadius: 14,
    boxShadow: '0 8px 40px rgba(26,58,92,0.2)',
    overflow: 'hidden',
    width: '100%',
    maxWidth: 420,
    margin: '0 1rem',
  },
  header: {
    background: '#1a3a5c',
    padding: '1.75rem 2rem 1.25rem',
    textAlign: 'center',
    color: '#fff',
  },
  icon: {
    fontSize: '2.8rem',
    marginBottom: '0.4rem',
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: '0.8rem',
    color: '#adc8e6',
    marginTop: '0.25rem',
  },
  body: {
    padding: '1.5rem 2rem',
  },
  hint: {
    fontSize: '0.88rem',
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: '1.25rem',
    lineHeight: 1.5,
  },
  erro: {
    background: '#fee2e2',
    color: '#991b1b',
    borderRadius: 8,
    padding: '0.6rem 0.875rem',
    fontSize: '0.85rem',
    marginBottom: '1rem',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    padding: '0.75rem 0.875rem',
    borderRadius: 8,
    border: '2px solid #d1d5db',
    fontSize: '1rem',
    marginBottom: '0.75rem',
    outline: 'none',
    transition: 'border-color 0.15s',
    textAlign: 'center',
    letterSpacing: '0.05em',
    boxSizing: 'border-box',
  },
  btnPrimary: {
    width: '100%',
    padding: '0.75rem',
    background: '#1a3a5c',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  manterSection: {
    marginTop: '1rem',
  },
  manterDivider: {
    textAlign: 'center',
    position: 'relative',
    marginBottom: '0.75rem',
  },
  manterDividerText: {
    background: '#fff',
    padding: '0 0.75rem',
    fontSize: '0.8rem',
    color: '#9ca3af',
    position: 'relative',
    zIndex: 1,
  },
  btnManter: {
    width: '100%',
    padding: '0.65rem',
    background: '#f0fdf4',
    color: '#065f46',
    border: '2px solid #6ee7b7',
    borderRadius: 8,
    fontSize: '0.88rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  footer: {
    textAlign: 'center',
    padding: '0.75rem',
    fontSize: '0.7rem',
    color: '#9ca3af',
    borderTop: '1px solid #f3f4f6',
  },
  btnCancelar: {
    background: 'none',
    border: 'none',
    color: '#6b7280',
    fontSize: '0.85rem',
    cursor: 'pointer',
    padding: '0.5rem 1rem',
    textDecoration: 'underline',
    transition: 'color 0.15s',
  },
}
