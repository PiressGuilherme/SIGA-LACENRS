import React from 'react'
import { createRoot } from 'react-dom/client'
import '../styles.css'
import ErrorBoundary from '../components/ErrorBoundary'
import Dashboard from '../pages/Dashboard/Dashboard'

const el = document.getElementById('dashboard-app')

if (!el) {
  console.error('[SIGA] #dashboard-app não encontrado no DOM')
} else {
  createRoot(el).render(
    <React.StrictMode>
      <ErrorBoundary>
        <Dashboard />
      </ErrorBoundary>
    </React.StrictMode>,
  )
}
