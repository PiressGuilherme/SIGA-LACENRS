/**
 * Cliente HTTP para os endpoints de dashboard.
 *
 * Todos aceitam:
 *   { periodo: '7d' | '30d' | '90d' | '365d' }
 *   ou { data_inicio: 'YYYY-MM-DD', data_fim: 'YYYY-MM-DD' }
 */
import api from './api'

function params(filtros) {
  const p = {}
  if (filtros?.data_inicio && filtros?.data_fim) {
    p.data_inicio = filtros.data_inicio
    p.data_fim = filtros.data_fim
  } else if (filtros?.periodo) {
    p.periodo = filtros.periodo
  }
  return { params: p }
}

export const dashboardApi = {
  resumo: (f) => api.get('/dashboard/resumo/', params(f)).then((r) => r.data),
  recebimento: (f) => api.get('/dashboard/recebimento/', params(f)).then((r) => r.data),
  tempos: (f) => api.get('/dashboard/tempos/', params(f)).then((r) => r.data),
  resultados: (f) => api.get('/dashboard/resultados/', params(f)).then((r) => r.data),
  operadores: (f) => api.get('/dashboard/operadores/', params(f)).then((r) => r.data),
}
