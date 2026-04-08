import React from 'react'
import { createRoot } from 'react-dom/client'
import ErrorBoundary from '../components/ErrorBoundary'
import Recebimento from '../pages/Recebimento'

const el = document.getElementById('recebimento-app')

if (!el) {
  console.error('[SIGA] #recebimento-app não encontrado no DOM')
} else {
  createRoot(el).render(
    <React.StrictMode>
      <ErrorBoundary>
      <Recebimento csrfToken={el.dataset.csrf} />
          </ErrorBoundary>
    </React.StrictMode>
  )
}
