import type { TipoConta } from './identidade'

export const ROTA_ENTRAR = '/entrar'
/** Destino padrão após o login. */
export const ROTA_INICIAL = '/inicio'

/** Indica se o tipo de conta pode abrir o caminho. Definido junto com as rotas da aplicação. */
export type PodeAcessar = (caminho: string, tipoConta: TipoConta) => boolean

/** Somente caminhos internos simples: sem '//', '\', '%', '.', ':', '?', '#' nem barra final. */
const PADRAO_INTERNO = /^\/(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?$/

/**
 * Destino depois do login. Aceita `de` (vindo de `location.state`) somente se for um caminho
 * interno, na mesma origem, fora de `/entrar` e de `/api`, e permitido para o tipo de conta.
 * Em qualquer outro caso, volta para a página inicial.
 */
export function destinoAposLogin(de: unknown, tipoConta: TipoConta, podeAcessar: PodeAcessar): string {
  if (typeof de !== 'string' || !PADRAO_INTERNO.test(de)) {
    return ROTA_INICIAL
  }
  const origem = window.location.origin
  const url = new URL(de, origem)
  if (url.origin !== origem || url.pathname !== de) {
    return ROTA_INICIAL
  }
  if (de === ROTA_ENTRAR || de === '/api' || de.startsWith('/api/')) {
    return ROTA_INICIAL
  }
  return podeAcessar(de, tipoConta) ? de : ROTA_INICIAL
}
