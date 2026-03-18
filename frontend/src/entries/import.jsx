import React from 'react'
import { createRoot } from 'react-dom/client'
import ImportCSV from '../pages/ImportCSV'

const el = document.getElementById('importar-csv-app')
if (el) {
  createRoot(el).render(
    <React.StrictMode>
      <ImportCSV csrfToken={el.dataset.csrf} />
    </React.StrictMode>
  )
}
