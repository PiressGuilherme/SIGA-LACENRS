/**
 * Utilitários de autenticação e verificação de permissões
 */

/**
 * Lê o CSRF token atual do cookie (sempre fresco após rotação de sessão)
 * @returns {string}
 */
export function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

/**
 * Obtém o usuário atual do localStorage
 * @returns {Object|null} Dados do usuário ou null se não autenticado
 */
export function getUsuarioAtual() {
  try {
    const data = localStorage.getItem('usuario')
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

/**
 * Verifica se o usuário atual é administrador (is_staff)
 * @returns {boolean}
 */
export function isAdmin() {
  const usuario = getUsuarioAtual()
  return usuario?.is_staff === true
}

/**
 * Retorna os dados do operador para uso nos módulos.
 * Se o usuário for admin, retorna os dados do próprio admin como operador.
 * Caso contrário, retorna null (será necessário validar via crachá).
 * @returns {Object|null}
 */
export function getOperadorInicial() {
  const usuario = getUsuarioAtual()
  if (!usuario) return null
  
  if (usuario.is_staff) {
    return {
      id: usuario.id,
      nome_completo: usuario.nome_completo,
      perfil: usuario.perfil || 'admin',
      numero_cracha: null, // Admin não precisa de crachá
      is_admin: true,
    }
  }
  
  return null // Não-admin precisa validar crachá
}

/**
 * Verifica se o usuário atual tem perfil de especialista ou supervisor.
 * Usado para restringir funcionalidades como termociclador e PDF de PCR.
 * @returns {boolean}
 */
export function isEspecialista() {
  const usuario = getUsuarioAtual()
  if (!usuario) return false
  if (usuario.is_staff) return true
  return ['especialista', 'supervisor'].includes(usuario.perfil)
}