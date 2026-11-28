import type { vi } from 'vitest'

/**
 * Backend simulado com a semântica de sessão do Java: um cookie por navegador (a sessão `atual`),
 * contexto por login e as mesmas recusas. Existe somente nos testes.
 */

export type Conta = { me: Record<string, unknown>; senha: string }
export type Chamada = { rota: string; contexto: string | null; csrf: string | null; corpo: string | null; sinal: AbortSignal | null }
type Interceptor = (chamada: Chamada) => Response | Promise<Response> | undefined

export const responderJson = (dados: unknown, status = 200, cabecalhos: Record<string, string> = {}) =>
  new Response(JSON.stringify(dados), { status, headers: { 'Content-Type': 'application/json', ...cabecalhos } })

export const responderProblema = (status: number, codigo: string) =>
  new Response(JSON.stringify({ status, codigo }), { status, headers: { 'Content-Type': 'application/problem+json' } })

export function servidorSimulado(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>, contas: Record<string, Conta>) {
  let logins = 0
  const chamadas: Chamada[] = []
  const interceptores = new Map<string, Interceptor>()

  const servidor = {
    /** Sessão que o cookie do navegador representa. */
    atual: null as { usuario: string; contexto: string } | null,
    chamadas,
    rotas: () => chamadas.map((c) => c.rota),
    da: (rota: string) => chamadas.filter((c) => c.rota === rota),
    /** Substitui a resposta de "MÉTODO /caminho". Devolver `undefined` segue o comportamento normal. */
    interceptar: (rota: string, interceptor: Interceptor) => interceptores.set(rota, interceptor),
    liberar: (rota: string) => interceptores.delete(rota),
    /** Autentica o "navegador" sem passar pela interface (outra aba ou página anterior). */
    abrir(usuario: string) {
      logins += 1
      servidor.atual = { usuario, contexto: `contexto-${logins}` }
      return servidor.atual
    },
    /** O que o Java responderia, ignorando interceptores. */
    processar(chamada: Chamada): Response {
      const [, caminho] = chamada.rota.split(' ')
      if (chamada.rota === 'GET /api/csrf') return responderJson({ headerName: 'X-XSRF-TOKEN', token: 'tokenCsrfDeTeste' })
      if (chamada.rota === 'POST /api/login') {
        const dados = new URLSearchParams(chamada.corpo ?? '')
        const usuario = dados.get('username') ?? ''
        if (contas[usuario]?.senha !== dados.get('password')) return responderProblema(401, 'AUTENTICACAO_NECESSARIA')
        servidor.abrir(usuario)
        return new Response(null, { status: 204 })
      }
      const sessao = servidor.atual
      const substituida = sessao !== null && chamada.contexto !== sessao.contexto
      if (chamada.rota === 'POST /api/logout') {
        if (substituida) return responderProblema(401, 'SESSAO_SUBSTITUIDA')
        servidor.atual = null
        return new Response(null, { status: 204 })
      }
      if (sessao === null) return responderProblema(401, 'AUTENTICACAO_NECESSARIA')
      if (substituida && !(caminho === '/api/me' && chamada.contexto === null)) {
        return responderProblema(401, 'SESSAO_SUBSTITUIDA')
      }
      if (chamada.rota === 'GET /api/me') {
        return responderJson(contas[sessao.usuario]?.me, 200, { 'X-Evolia-Contexto': sessao.contexto })
      }
      return new Response(null, { status: 404 })
    },
  }

  fetchMock.mockImplementation((url, init) => {
    const cabecalhos = new Headers(init?.headers)
    if (cabecalhos.has('Authorization')) throw new Error('A interface não pode enviar Authorization.')
    const chamada: Chamada = {
      rota: `${init?.method ?? 'GET'} ${String(url)}`,
      contexto: cabecalhos.get('X-Evolia-Contexto'),
      csrf: cabecalhos.get('X-XSRF-TOKEN'),
      corpo: typeof init?.body === 'string' ? init.body : null,
      sinal: init?.signal ?? null,
    }
    chamadas.push(chamada)
    return Promise.resolve(interceptores.get(chamada.rota)?.(chamada) ?? servidor.processar(chamada))
  })

  return servidor
}
