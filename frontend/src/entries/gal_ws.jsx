import React from 'react'
import { createRoot } from 'react-dom/client'
import ErrorBoundary from '../components/ErrorBoundary'
import GalWs from '../pages/GalWs'

const el = document.getElementById('gal-ws-app')

if (!el) {
  console.error('[SIGA] #gal-ws-app não encontrado no DOM')
} else {
  createRoot(el).render(
    <React.StrictMode>
      <ErrorBoundary>
      <GalWs csrfToken={el.dataset.csrf} />
          </ErrorBoundary>
    </React.StrictMode>
  )
}
