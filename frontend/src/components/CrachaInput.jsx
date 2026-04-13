/**
 * CrachaInput — validação de crachá por leitura ou digitação.
 *
 * Props:
 *   onValidado(user | null)  chamado após cada tentativa de validação
 *   label                    texto do painel (default: 'Identificação do Operador')
 *
 * Comportamento:
 *   - Ao validar com sucesso: chama onValidado({ id, nome_completo, perfil, numero_cracha })
 *   - Ao escanear um novo crachá: chama onValidado com o novo operador (swap sem perda de dados)
 *   - Foco automático no input ao montar
 */
import { useState, useRef, useEffect } from 'react'
import Icon from './Icon'

export default function CrachaInput({ onValidado, label = 'Identificação do Operador' }) {
  const [codigo, setCodigo]       = useState('')
  const [operador, setOperador]   = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro]           = useState(null)
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
      // Não limpa o operador anterior — operador atual continua válido
    } finally {
      setCodigo('')
      setCarregando(false)
      // Re-foca para a próxima leitura
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return (
    <div style={{
      background: operador ? '#f0fdf4' : '#f8fafc',
      border: `1px solid ${operador ? '#6ee7b7' : '#e2e8f0'}`,
      borderRadius: 8,
      padding: '0.9rem 1.1rem',
      marginBottom: '1.25rem',
      transition: 'background 0.2s, border-color 0.2s',
    }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="text"
          value={codigo}
          onChange={e => setCodigo(e.target.value)}
          placeholder="Escaneie ou digite o código do crachá..."
          disabled={carregando}
          autoComplete="off"
          style={{
            flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.95rem',
            border: '2px solid #cbd5e1', borderRadius: 6, outline: 'none',
            background: '#fff',
          }}
        />
        <button
          type="submit"
          disabled={carregando || !codigo.trim()}
          style={{
            padding: '0.5rem 0.9rem', fontSize: '0.85rem', fontWeight: 600,
            background: '#1a3a5c', color: '#fff', border: 'none', borderRadius: 6,
            cursor: (carregando || !codigo.trim()) ? 'default' : 'pointer',
            opacity: (carregando || !codigo.trim()) ? 0.5 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {carregando ? '...' : 'Validar'}
        </button>
      </form>

      {/* Operador atual */}
      {operador && (
        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.9rem', color: '#065f46', fontWeight: 600 }}>
            <Icon name="check" /> {operador.nome_completo}
          </span>
          <span style={{
            fontSize: '0.72rem', background: '#d1fae5', color: '#065f46',
            padding: '1px 6px', borderRadius: 10, fontWeight: 500,
          }}>
            {operador.perfil}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 'auto' }}>
            Escaneie um novo crachá para trocar de operador
          </span>
        </div>
      )}

      {/* Erro de validação */}
      {erro && (
        <div style={{ marginTop: '0.4rem', fontSize: '0.82rem', color: '#b91c1c' }}>
          <Icon name="warning" /> {erro}
        </div>
      )}
    </div>
  )
}
