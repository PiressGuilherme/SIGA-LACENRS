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
        login: resolve(__dirname, 'src/entries/login.jsx'),
        import: resolve(__dirname, 'src/entries/import.jsx'),
        aliquotagem: resolve(__dirname, 'src/entries/aliquotagem.jsx'),
        plates: resolve(__dirname, 'src/entries/plates.jsx'),
        pcr: resolve(__dirname, 'src/entries/pcr.jsx'),
        consulta: resolve(__dirname, 'src/entries/consulta.jsx'),
        resultados: resolve(__dirname, 'src/entries/resultados.jsx'),
        gal_ws: resolve(__dirname, 'src/entries/gal_ws.jsx'),
        configuracoes: resolve(__dirname, 'src/entries/configuracoes.jsx'),
      },
    },
  },

  server: {
    port: 5173,
    host: true,
    // Permite que o browser carregue scripts do Vite mesmo com a página
    // vindo de uma origem diferente (Django em :8000)
    cors: true,
    // Necessário para que o servidor de dev do Vite sirva assets em /static/
    // alinhando com o base: '/static/' e com as URLs geradas pelo django-vite
    base: '/static/',
  },
})
