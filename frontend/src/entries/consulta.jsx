import React from 'react'
import { createRoot } from 'react-dom/client'
import ConsultaAmostras from '../pages/ConsultaAmostras'

const el = document.getElementById('consulta-app')

if (!el) {
  console.error('[SIGA] #consulta-app não encontrado no DOM')
} else {
  createRoot(el).render(
    <React.StrictMode>
      <ConsultaAmostras csrfToken={el.dataset.csrf} />
    </React.StrictMode>
  )
}
