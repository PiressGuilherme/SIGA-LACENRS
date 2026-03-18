import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],

  root: resolve(__dirname, 'src'),

  build: {
    outDir: resolve(__dirname, '../backend/static/vite'),
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: {
        import: resolve(__dirname, 'src/entries/import.jsx'),
        plates: resolve(__dirname, 'src/entries/plates.jsx'),
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
