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
    <header className="bg-brand-800 px-6 py-3 flex items-center justify-between border-b-[3px] border-brand-900">
      <a
        href="/"
        className="text-white no-underline text-[1.1rem] font-bold tracking-wide"
      >
        SIGA-LACEN
      </a>

      <div className="flex items-center gap-4">
        {usuario && (
          <span className="text-brand-300 text-[0.85rem] font-medium">
            {usuario.nome_completo}
            {usuario.is_staff && (
              <span className="ml-2 bg-white/20 px-1.5 py-0.5 rounded text-[0.7rem] font-semibold">
                Admin
              </span>
            )}
          </span>
        )}
        <button
          onClick={handleLogout}
          className="bg-white/15 text-white border border-white/30 px-4 py-1.5 rounded-md cursor-pointer text-[0.85rem] font-medium hover:bg-white/25 transition-colors"
        >
          Sair
        </button>
      </div>
    </header>
  )
}