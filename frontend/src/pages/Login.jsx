import { useEffect, useRef, useState } from 'react'

const s = {
  wrapper: {
    width: '100%', maxWidth: 420,
    padding: '0 1rem',
  },
  card: {
    background: '#fff',
    borderRadius: 14,
    boxShadow: '0 4px 32px rgba(26,58,92,0.13)',
    overflow: 'hidden',
  },
  header: {
    background: '#1a3a5c',
    padding: '2rem 2rem 1.5rem',
    textAlign: 'center',
    color: '#fff',
  },
  logo: {
    fontSize: '2.2rem',
    marginBottom: '0.5rem',
  },
  title: {
    fontSize: '1.3rem',
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: '0.8rem',
    color: '#adc8e6',
    marginTop: '0.25rem',
  },
  body: {
    padding: '1.75rem 2rem',
  },
  tabBar: {
    display: 'flex',
    borderBottom: '2px solid #e5e7eb',
    marginBottom: '1.5rem',
  },
  tab: (active) => ({
    flex: 1,
    padding: '0.6rem 0',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: active ? '#1a3a5c' : '#9ca3af',
    borderBottom: active ? '2px solid #1a3a5c' : '2px solid transparent',
    marginBottom: -2,
    transition: 'color 0.15s',
  }),
  label: {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: 5,
  },
  input: {
    width: '100%',
    padding: '0.65rem 0.875rem',
    borderRadius: 8,
    border: '1.5px solid #d1d5db',
    fontSize: '0.9rem',
    marginBottom: '1rem',
    outline: 'none',
    transition: 'border-color 0.15s',
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
    marginTop: '0.25rem',
    transition: 'background 0.15s',
  },
  erro: {
    background: '#fee2e2',
    color: '#991b1b',
    borderRadius: 8,
    padding: '0.6rem 0.875rem',
    fontSize: '0.85rem',
    marginBottom: '1rem',
  },
  crachaArea: {
    textAlign: 'center',
    padding: '0.5rem 0 1rem',
  },
  crachaIcon: {
    fontSize: '3.5rem',
    marginBottom: '0.5rem',
    opacity: 0.85,
  },
  crachaHint: {
    fontSize: '0.82rem',
    color: '#6b7280',
    lineHeight: 1.5,
    marginBottom: '1.25rem',
  },
  crachaInput: {
    position: 'absolute',
    left: -9999,
    opacity: 0,
    width: 1,
    height: 1,
  },
  crachaStatus: (lendo) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '0.6rem 1.25rem',
    borderRadius: 999,
    border: `2px solid ${lendo ? '#1a3a5c' : '#d1d5db'}`,
    background: lendo ? '#eff6ff' : '#f9fafb',
    color: lendo ? '#1a3a5c' : '#6b7280',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  }),
  dot: (lendo) => ({
    width: 10, height: 10,
    borderRadius: '50%',
    background: lendo ? '#22c55e' : '#d1d5db',
    boxShadow: lendo ? '0 0 0 3px #bbf7d0' : 'none',
    transition: 'all 0.3s',
  }),
}

// ---------------------------------------------------------------------------
// Aba: email + senha
// ---------------------------------------------------------------------------
function TabEmail({ onSuccess, csrf }) {
  const [form, setForm] = useState({ email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function submeter(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      const res = await fetch('/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
        body: JSON.stringify({ email: form.email, senha: form.senha }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.erro || 'Erro ao autenticar.'); return }
      onSuccess(data)
    } catch {
      setErro('Não foi possível conectar ao servidor.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <form onSubmit={submeter}>
      {erro && <div style={s.erro}>{erro}</div>}
      <label style={s.label}>E-mail</label>
      <input
        style={s.input}
        type="email"
        autoFocus
        autoComplete="email"
        value={form.email}
        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        placeholder="seu@email.com"
        required
      />
      <label style={s.label}>Senha</label>
      <input
        style={s.input}
        type="password"
        autoComplete="current-password"
        value={form.senha}
        onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
        placeholder="••••••••"
        required
      />
      <button type="submit" style={s.btnPrimary} disabled={carregando}>
        {carregando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Aba: crachá
// ---------------------------------------------------------------------------
function TabCracha({ onSuccess, csrf }) {
  const [lendo, setLendo] = useState(false)
  const [erro, setErro] = useState('')
  const [buffer, setBuffer] = useState('')
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  // Foca o input oculto ao ativar a aba
  useEffect(() => {
    if (lendo) inputRef.current?.focus()
  }, [lendo])

  function ativar() {
    setErro('')
    setBuffer('')
    setLendo(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // Leitores de barcode enviam os caracteres rapidamente e terminam com Enter.
  // Capturamos via keydown no input oculto.
  function handleKeyDown(e) {
    if (!lendo) return
    clearTimeout(timerRef.current)

    if (e.key === 'Enter') {
      const numero = buffer.trim()
      setBuffer('')
      if (numero) autenticar(numero)
      return
    }

    if (e.key.length === 1) {
      setBuffer(b => b + e.key)
      // Timeout: se o leitor parar de enviar por 300ms, tenta com o que tem
      timerRef.current = setTimeout(() => {
        const numero = buffer.trim() + e.key
        setBuffer('')
        if (numero) autenticar(numero)
      }, 300)
    }
  }

  async function autenticar(numero) {
    setLendo(false)
    setErro('')
    try {
      const res = await fetch('/api/auth/login-cracha/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
        body: JSON.stringify({ numero_cracha: numero }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.erro || 'Crachá não reconhecido.')
      } else {
        onSuccess(data)
      }
    } catch {
      setErro('Não foi possível conectar ao servidor.')
    }
  }

  return (
    <div style={s.crachaArea}>
      {erro && <div style={{ ...s.erro, textAlign: 'left' }}>{erro}</div>}

      <div style={s.crachaIcon}>ID</div>
      <p style={s.crachaHint}>
        {lendo
          ? 'Passe o crachá no leitor agora…'
          : 'Clique no botão abaixo e passe o crachá no leitor.'}
      </p>

      <button type="button" style={s.crachaStatus(lendo)} onClick={ativar}>
        <span style={s.dot(lendo)} />
        {lendo ? 'Aguardando leitura…' : 'Ativar leitor de crachá'}
      </button>

      {/* Input oculto que captura o barcode */}
      <input
        ref={inputRef}
        style={s.crachaInput}
        onKeyDown={handleKeyDown}
        onBlur={() => setLendo(false)}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function Login({ csrfToken, nextUrl }) {
  const [aba, setAba] = useState('email')

  function onSuccess({ access, refresh, usuario }) {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
    localStorage.setItem('usuario', JSON.stringify(usuario))
    window.location.href = nextUrl || '/'
  }

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <div style={s.header}>
          <div style={s.logo}>SIGA</div>
          <div style={s.title}>SIGA-LACEN</div>
          <div style={s.subtitle}>
            Sistema de Informação e Gerenciamento de Amostras
          </div>
          <div style={{ ...s.subtitle, marginTop: '0.1rem' }}>
            Laboratório de HPV · LACEN-RS / CEVS
          </div>
        </div>

        <div style={s.body}>
          <div style={s.tabBar}>
            <button style={s.tab(aba === 'email')}  onClick={() => setAba('email')}>
              E-mail e Senha
            </button>
            <button style={s.tab(aba === 'cracha')} onClick={() => setAba('cracha')}>
              Crachá
            </button>
          </div>

          {aba === 'email'  && <TabEmail  onSuccess={onSuccess} csrf={csrfToken} />}
          {aba === 'cracha' && <TabCracha onSuccess={onSuccess} csrf={csrfToken} />}
        </div>
      </div>

      <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.75rem', color: '#9ca3af' }}>
        LACEN-RS · CEVS · Secretaria da Saúde do RS
      </p>
    </div>
  )
}
