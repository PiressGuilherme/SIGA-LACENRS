import React from 'react'
import { createRoot } from 'react-dom/client'
import ImportCSV from '../pages/ImportCSV'

const el = document.getElementById('importar-csv-app')

if (!el) {
  console.error('[SIGA] #importar-csv-app não encontrado no DOM')
} else {
  createRoot(el).render(
    <React.StrictMode>
      <ImportCSV csrfToken={el.dataset.csrf} />
    </React.StrictMode>
  )
}
