import React from 'react'
import { createRoot } from 'react-dom/client'
import ErrorBoundary from '../components/ErrorBoundary'
import RevisarResultados from '../pages/RevisarResultados'

const el = document.getElementById('resultados-app')

if (!el) {
  console.error('[SIGA] #resultados-app não encontrado no DOM')
} else {
  createRoot(el).render(
    <React.StrictMode>
      <ErrorBoundary>
      <RevisarResultados csrfToken={el.dataset.csrf} />
          </ErrorBoundary>
    </React.StrictMode>
  )
}
