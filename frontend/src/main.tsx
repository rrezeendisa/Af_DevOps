import '@/lib/configurar-zod'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource-variable/inter'
import '@fontsource-variable/fraunces'
import '@fontsource-variable/fraunces/wght-italic.css'
import '@/styles/index.css'
import { App } from '@/app/App'
import { Providers } from '@/app/Providers'

const raiz = document.getElementById('root')
if (!raiz) {
  throw new Error('Elemento #root não encontrado.')
}

// Em produção, as falhas capturadas aparecem pela mensagem pública do ErrorBoundary.
const opcoes = import.meta.env.PROD ? { onCaughtError: () => {} } : undefined

createRoot(raiz, opcoes).render(
  <StrictMode>
    <BrowserRouter>
      <Providers>
        <App />
      </Providers>
    </BrowserRouter>
  </StrictMode>,
)
