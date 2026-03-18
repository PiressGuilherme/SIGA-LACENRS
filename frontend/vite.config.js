import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/**
 * Configuração Vite para integração com Django via django-vite.
 *
 * Em desenvolvimento:
 *   - O Vite roda como dev server com HMR (hot module replacement)
 *   - Django carrega os assets via tag {% vite_asset %}
 *
 * Em produção (npm run build):
 *   - Os bundles são gerados em backend/static/vite/
 *   - Django serve via collectstatic + Nginx
 */
export default defineConfig({
  plugins: [react()],

  // Ponto de entrada dos módulos React
  root: resolve(__dirname, 'src'),

  build: {
    // Saída vai para o diretório static do Django
    outDir: resolve(__dirname, '../backend/static/vite'),
    emptyOutDir: true,
    manifest: true,  // Necessário para django-vite mapear os hashes de produção

    rollupOptions: {
      input: {
        // Entrypoints por módulo — cada um é uma "ilha" React
        plates: resolve(__dirname, 'src/entries/plates.jsx'),
        // Fase 6: dashboard: resolve(__dirname, 'src/entries/dashboard.jsx'),
      },
    },
  },

  server: {
    // Dev server do Vite roda na porta 5173
    // O Django aponta para esse servidor via DJANGO_VITE_DEV_SERVER_URL
    port: 5173,
    host: true,
  },
})
