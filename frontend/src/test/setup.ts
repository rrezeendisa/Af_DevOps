import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// O jsdom não implementa matchMedia. Padrão: sistema em tema claro, sem mudanças.
// Testes que precisam de outro comportamento substituem com vi.stubGlobal('matchMedia', ...).
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}

// O jsdom não implementa rolagem e avisa no console; nos testes ela não tem efeito.
window.scrollTo = () => {}

afterEach(() => {
  cleanup()
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = ''
})
