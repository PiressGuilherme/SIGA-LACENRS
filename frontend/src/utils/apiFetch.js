import { getCsrfToken } from './auth'

export default async function apiFetch(url, { method = 'GET', body, isMultipart = false } = {}) {
  const headers = { 'X-CSRFToken': getCsrfToken() }
  const token = localStorage.getItem('access_token')
  if (token) headers['Authorization'] = `Bearer ${token}`

  const opts = { method, headers, credentials: 'same-origin' }
  if (body && !isMultipart) {
    headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  } else if (body && isMultipart) {
    opts.body = body  // FormData — não definir Content-Type (boundary automático)
  }

  const res = await fetch(url, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw { status: res.status, data }
  return data
}
