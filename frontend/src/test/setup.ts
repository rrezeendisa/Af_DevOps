import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// Espera de `findBy*` e `waitFor`: 3 s em vez de 1 s, só nos testes. Com os arquivos em paralelo e a
// máquina carregada, a primeira renderização de uma página carregada sob demanda passa de 1 s.
// Ver PENDENCIAS.md.
configure({ asyncUtilTimeout: 3000 })

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
