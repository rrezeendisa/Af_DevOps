import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Maior que o pior caso da orientação no backend (~67 s). Ver API_CONTRACTS.md, seção 8.
const TEMPO_LIMITE_PROXY_MS = 90_000

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'BACKEND_')
  const porta = env.BACKEND_PORT ?? '8080'
  if (!/^\d{1,5}$/.test(porta)) {
    throw new Error('BACKEND_PORT deve ser um número de porta.')
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    // A CSP usa img-src/font-src 'self': nenhum asset pode virar data: URI.
    build: { assetsInlineLimit: 0 },
    server: {
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${porta}`,
          timeout: TEMPO_LIMITE_PROXY_MS,
          proxyTimeout: TEMPO_LIMITE_PROXY_MS,
        },
      },
    },
  }
})
