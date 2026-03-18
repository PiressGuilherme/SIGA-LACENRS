/**
 * Cliente HTTP centralizado para a API Django.
 * Todas as chamadas à API passam por este módulo.
 *
 * Uso:
 *   import api from '@/services/api'
 *   const { data } = await api.get('/amostras/')
 */
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Injeta o token JWT automaticamente em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Intercepta 401 para forçar re-login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token')
      window.location.href = '/admin/login/'
    }
    return Promise.reject(error)
  }
)

export default api
