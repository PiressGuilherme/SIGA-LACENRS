import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],

  // Alinha com STATIC_URL do Django para que django-vite gere URLs corretas
  // tanto em dev (http://localhost:5173/static/...) quanto em produção
  base: '/static/',

  root: resolve(__dirname, 'src'),

  build: {
    outDir: resolve(__dirname, '../backend/static'),
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: {
        import: resolve(__dirname, 'src/entries/import.jsx'),
        recebimento: resolve(__dirname, 'src/entries/recebimento.jsx'),
        plates: resolve(__dirname, 'src/entries/plates.jsx'),
        consulta: resolve(__dirname, 'src/entries/consulta.jsx'),
        resultados: resolve(__dirname, 'src/entries/resultados.jsx'),
      },
    },
  },

  server: {
    port: 5173,
    host: true,
    // Permite que o browser carregue scripts do Vite mesmo com a página
    // vindo de uma origem diferente (Django em :8000)
    cors: true,
  },
})
