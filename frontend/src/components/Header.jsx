/**
 * Header — Cabeçalho principal do sistema
 */
export default function Header() {
  // Lê dados do usuário logado do localStorage
  let usuario = null
  try {
    const data = localStorage.getItem('usuario')
    if (data) usuario = JSON.parse(data)
  } catch {}

  function handleLogout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('usuario')
    window.location.href = '/login/'
  }

  return (
    <header style={{
      background: '#1a3a5c',
      padding: '0.75rem 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '3px solid #0d2137',
    }}>
      <a
        href="/"
        style={{
          color: '#fff',
          textDecoration: 'none',
          fontSize: '1.1rem',
          fontWeight: 700,
          letterSpacing: 0.5,
        }}
      >
        SIGA-LACEN
      </a>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {usuario && (
          <span style={{
            color: '#adc8e6',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}>
            {usuario.nome_completo}
            {usuario.is_staff && (
              <span style={{
                marginLeft: '0.5rem',
                background: 'rgba(255,255,255,0.2)',
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: '0.7rem',
                fontWeight: 600,
              }}>
                Admin
              </span>
            )}
          </span>
        )}
        <button
          onClick={handleLogout}
          style={{
            background: 'rgba(255,255,255,0.15)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)',
            padding: '0.4rem 1rem',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}
        >
          Sair
        </button>
      </div>
    </header>
  )
}
