import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { App } from '@/app/App'
import { AppRotas } from '@/app/AppRotas'
import { Providers } from '@/app/Providers'
import { criarQueryClient } from '@/app/queryClient'
import { ProvedorTema } from '@/components/tema/ProvedorTema'
import { AuthContext, type ValorAuth } from '@/features/auth/contexto'
import { lerIdentidade, type TipoConta } from '@/features/auth/identidade'
import { criarSessaoApi } from '@/lib/api/cliente'

// Utilitários de teste. Respostas simuladas existem somente nos testes.

export const ME: Record<TipoConta, { nomeUsuario: string; perfil: string; colaboradorId?: number }> = {
  ADMIN: { nomeUsuario: 'admin', perfil: 'ADMIN' },
  COLABORADOR_INDIVIDUAL: { nomeUsuario: 'ana', perfil: 'COLABORADOR', colaboradorId: 7 },
  COLABORADOR_DEMONSTRACAO: { nomeUsuario: 'colab.demo', perfil: 'COLABORADOR' },
}

export function json(dados: unknown, status = 200, tipo = 'application/json'): Response {
  return new Response(JSON.stringify(dados), { status, headers: { 'Content-Type': tipo } })
}

export function problema(status: number, codigo: string): Response {
  return json({ status, codigo }, status, 'application/problem+json')
}

export function criarFetch() {
  const fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export const TOKEN_CSRF = 'tokenCsrfDeTeste'

/** Respostas por "MÉTODO /caminho". O CSRF já vem respondido; rota não listada recebe 404. */
export type RotasSimuladas = Record<string, (init: RequestInit | undefined) => Response | Promise<Response>>

export function rotear(fetchMock: ReturnType<typeof criarFetch>, rotas: RotasSimuladas) {
  fetchMock.mockImplementation((url, init) => {
    const chave = `${init?.method ?? 'GET'} ${String(url)}`
    const resposta = rotas[chave]
    if (resposta) return Promise.resolve(resposta(init))
    if (chave === 'GET /api/csrf') return Promise.resolve(json({ headerName: 'X-XSRF-TOKEN', token: TOKEN_CSRF }))
    return Promise.resolve(new Response(null, { status: 404 }))
  })
}

/** Sessão do cliente real que já recebeu um contexto, como depois do login. */
export async function sessaoComContexto(fetchMock: ReturnType<typeof criarFetch>, contexto: string) {
  fetchMock.mockImplementationOnce(() =>
    Promise.resolve(
      new Response('{}', { headers: { 'Content-Type': 'application/json', 'X-Evolia-Contexto': contexto } }),
    ),
  )
  const api = criarSessaoApi()
  await api.retomar((dados) => dados)
  return api
}

/** Chamadas feitas como "MÉTODO /caminho", na ordem. */
export function chamadas(fetchMock: ReturnType<typeof criarFetch>): string[] {
  return fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${String(url)}`)
}

/** Corpo JSON enviado na chamada indicada. */
export function corpoEnviado(fetchMock: ReturnType<typeof criarFetch>, chamada: string): unknown {
  const indice = chamadas(fetchMock).indexOf(chamada)
  const corpo = fetchMock.mock.calls[indice]?.[1]?.body
  return typeof corpo === 'string' ? JSON.parse(corpo) : corpo
}

/**
 * Monta as rotas reais com uma sessão autenticada controlada (sessão real do cliente HTTP,
 * `fetch` simulado). Inclui tema e TanStack Query.
 */
export function renderizarAutenticado(
  tipoConta: TipoConta,
  caminho = '/inicio',
  rotas: RotasSimuladas = {},
  /** Elemento a montar no lugar das rotas (útil com fake timers, sem lazy loading). */
  elemento?: ReactNode,
  /** Monta sob `<StrictMode>`, como em desenvolvimento. */
  strict = false,
) {
  const fetchMock = criarFetch()
  rotear(fetchMock, rotas)
  const api = criarSessaoApi()
  const valor: ValorAuth = {
    estado: { status: 'autenticado', identidade: lerIdentidade(ME[tipoConta]), tipoConta, api, geracao: 1 },
    entrar: vi.fn(),
    sair: vi.fn(),
    continuar: vi.fn(),
  }
  const queryClient = criarQueryClient()
  const usuario = userEvent.setup()
  const arvore = (
    <ProvedorTema>
      <QueryClientProvider client={queryClient}>
        <AuthContext value={valor}>
          <MemoryRouter initialEntries={[caminho]}>
            {elemento ?? <AppRotas />}
          </MemoryRouter>
        </AuthContext>
      </QueryClientProvider>
    </ProvedorTema>
  )
  const resultado = render(strict ? <StrictMode>{arvore}</StrictMode> : arvore)
  return { usuario, valor, fetchMock, queryClient, api, ...resultado }
}

/** Monta a aplicação completa (tema, query, auth e rotas) em um roteador de memória. */
export function renderizarApp(caminho = '/', estado?: unknown) {
  const usuario = userEvent.setup()
  const resultado = render(
    <MemoryRouter initialEntries={[estado === undefined ? caminho : { pathname: caminho, state: estado }]}>
      <Providers>
        <App />
      </Providers>
    </MemoryRouter>,
  )
  return { usuario, ...resultado }
}

/** Preenche e envia o formulário de login pela interface. */
export async function preencherLogin(
  usuario: ReturnType<typeof userEvent.setup>,
  nomeUsuario = 'usuario',
  senha = 'senha-de-teste-1',
) {
  await usuario.type(screen.getByLabelText('Nome de usuário'), nomeUsuario)
  await usuario.type(screen.getByLabelText('Senha'), senha)
  await usuario.click(screen.getByRole('button', { name: 'Entrar' }))
}

export function itensDaSidebar(): string[] {
  const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent ?? '')
}
