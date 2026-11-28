/**
 * Preferência de tema: a única informação que a Evolia persiste no navegador.
 * O script inline de `index.html` repete esta lógica para aplicar o tema antes do primeiro paint.
 * Ao alterar a chave ou os valores, atualize os dois lugares.
 */
export const CHAVE_TEMA = 'evolia:tema'

export type PreferenciaTema = 'claro' | 'escuro' | 'sistema'
export type TemaAplicado = 'claro' | 'escuro'

const PREFERENCIAS: readonly PreferenciaTema[] = ['claro', 'escuro', 'sistema']
const CONSULTA_ESCURO = '(prefers-color-scheme: dark)'

function ehPreferencia(valor: unknown): valor is PreferenciaTema {
  return typeof valor === 'string' && (PREFERENCIAS as readonly string[]).includes(valor)
}

/** Lê a preferência salva. Valor inválido ou armazenamento indisponível resultam em `sistema`. */
export function lerPreferencia(): PreferenciaTema {
  try {
    const valor = window.localStorage.getItem(CHAVE_TEMA)
    return ehPreferencia(valor) ? valor : 'sistema'
  } catch {
    return 'sistema'
  }
}

/** Salva a preferência. Falhas (modo privado, cota) são ignoradas: o tema continua funcionando na sessão. */
export function salvarPreferencia(preferencia: PreferenciaTema): void {
  try {
    window.localStorage.setItem(CHAVE_TEMA, preferencia)
  } catch {
    // Sem persistência disponível.
  }
}

export function consultaSistema(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(CONSULTA_ESCURO) : null
}

export function resolverTema(preferencia: PreferenciaTema): TemaAplicado {
  if (preferencia !== 'sistema') {
    return preferencia
  }
  return consultaSistema()?.matches ? 'escuro' : 'claro'
}

/** Aplica o tema no `<html>`, sem animar as cores durante a troca. */
export function aplicarTema(tema: TemaAplicado): void {
  const raiz = document.documentElement
  raiz.classList.add('sem-transicao')
  raiz.classList.toggle('dark', tema === 'escuro')
  raiz.style.colorScheme = tema === 'escuro' ? 'dark' : 'light'
  // Força o recálculo de estilo antes de reativar as transições.
  void raiz.offsetHeight
  raiz.classList.remove('sem-transicao')
}
