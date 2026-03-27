import React from 'react'
import { createRoot } from 'react-dom/client'
import Login from '../pages/Login'

const el = document.getElementById('login-app')

if (!el) {
  console.error('[SIGA] #login-app não encontrado no DOM')
} else {
  createRoot(el).render(
    <React.StrictMode>
      <Login
        csrfToken={el.dataset.csrf}
        nextUrl={el.dataset.next || '/'}
      />
    </React.StrictMode>
  )
}
