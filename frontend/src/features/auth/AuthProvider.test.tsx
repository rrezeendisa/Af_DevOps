import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { StrictMode, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarQueryClient } from '@/app/queryClient'
import { codificarBasic } from '@/lib/api/credenciais'
import { ApiError } from '@/lib/api/erros'
import { AuthProvider } from './AuthProvider'
import { useAuth, useSessaoApi, type ResultadoLogin, type ValorAuth } from './contexto'

// Respostas simuladas existem somente nestes testes.

const ANA = { nomeUsuario: 'ana', senha: 'senha-da-ana-çã€1' }
const BRUNO = { nomeUsuario: 'bruno', senha: 'senha-do-bruno-123' }
const BASIC_ANA = codificarBasic(ANA)
const BASIC_BRUNO = codificarBasic(BRUNO)

const ME_ADMIN = { nomeUsuario: 'ana', perfil: 'ADMIN' }
const ME_INDIVIDUAL = { nomeUsuario: 'bruno', perfil: 'COLABORADOR', colaboradorId: 7 }
const ME_DEMONSTRACAO = { nomeUsuario: 'colab.demo', perfil: 'COLABORADOR' }

const fetchMock = vi.fn<typeof fetch>()

function json(dados: unknown, status = 200, tipo = 'application/json'): Response {
  return new Response(JSON.stringify(dados), { status, headers: { 'Content-Type': tipo } })
}

function problema(status: number, codigo: string): Response {
  return json({ status, codigo }, status, 'application/problem+json')
}

function adiado<T>() {
  let resolver: (valor: T) => void = () => {}
  const promessa = new Promise<T>((r) => {
    resolver = r
  })
  return { promessa, resolver }
}

type Requisicao = { url: string; autorizacao: string | null; sinal: AbortSignal | undefined; csrf: boolean }

function requisicoes(): Requisicao[] {
  return fetchMock.mock.calls.map(([url, init]) => {
    const cabecalhos = new Headers(init?.headers)
    return {
      url: String(url),
      autorizacao: cabecalhos.get('Authorization'),
      sinal: init?.signal ?? undefined,
      csrf: cabecalhos.has('X-XSRF-TOKEN'),
    }
  })
}

/** Roteia por caminho e por usuário (cabeçalho Basic). */
function responder(rotas: Record<string, (autorizacao: string | null) => Promise<Response> | Response>) {
  fetchMock.mockImplementation((url, init) => {
    const rota = rotas[String(url)]
    if (!rota) throw new Error(`Rota não simulada: ${String(url)}`)
    return Promise.resolve(rota(new Headers(init?.headers).get('Authorization')))
  })
}

const sonda: { auth: ValorAuth | null } = { auth: null }

function auth(): ValorAuth {
  if (!sonda.auth) throw new Error('AuthProvider não montado.')
  return sonda.auth
}

function Sonda() {
  const valor = useAuth()
  useEffect(() => {
    sonda.auth = valor
  })
  const { estado } = valor
  return (
    <p data-testid="estado">
      {estado.status === 'autenticado'
        ? `${estado.status}:${estado.identidade.nomeUsuario}:${estado.tipoConta}`
        : estado.status === 'anonimo'
          ? `${estado.status}:${estado.motivo}`
          : estado.status}
    </p>
  )
}

const aceitar = (dados: unknown) => dados

function Cursos() {
  const { api, chave } = useSessaoApi()
  const consulta = useQuery({
    queryKey: [...chave, 'cursos'],
    queryFn: ({ signal }) => api.obter('/api/cursos', aceitar, { signal }),
  })
  return <p data-testid="cursos">{consulta.status}</p>
}

function AreaPrivada({ comCursos }: { comCursos: boolean }) {
  const { estado } = useAuth()
  return estado.status === 'autenticado' && comCursos ? <Cursos /> : null
}

function renderizar({ strict = false, comCursos = false } = {}) {
  const queryClient = criarQueryClient()
  const arvore = (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Sonda />
        <AreaPrivada comCursos={comCursos} />
      </AuthProvider>
    </QueryClientProvider>
  )
  const resultado = render(strict ? <StrictMode>{arvore}</StrictMode> : arvore)
  return { queryClient, ...resultado }
}

const estadoVisivel = () => screen.getByTestId('estado').textContent

async function entrar(credenciais: typeof ANA): Promise<ResultadoLogin> {
  let resultado: ResultadoLogin = { ok: false, motivo: 'cancelado' }
  await act(async () => {
    resultado = await auth().entrar(credenciais)
  })
  return resultado
}

/** Inicia o login sem aguardar o resultado. */
function iniciarLogin(credenciais: typeof ANA): Promise<ResultadoLogin> {
  let pendente: Promise<ResultadoLogin> = Promise.resolve({ ok: false, motivo: 'cancelado' })
  act(() => {
    pendente = auth().entrar(credenciais)
  })
  return pendente
}

async function esvaziar(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

function sessaoAtual() {
  const { estado } = auth()
  if (estado.status !== 'autenticado') throw new Error('Sem sessão autenticada.')
  return estado
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  sonda.auth = null
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('login', () => {
  it('autentica pelo GET /api/me com Basic, sem CSRF', async () => {
    responder({ '/api/me': () => json(ME_ADMIN) })
    renderizar()
    expect(estadoVisivel()).toBe('anonimo:inicial')

    expect(await entrar(ANA)).toEqual({ ok: true })

    expect(estadoVisivel()).toBe('autenticado:ana:ADMIN')
    expect(requisicoes()).toEqual([
      { url: '/api/me', autorizacao: BASIC_ANA, sinal: expect.any(AbortSignal), csrf: false },
    ])
  })

  it.each([
    [ME_ADMIN, 'ADMIN'],
    [ME_INDIVIDUAL, 'COLABORADOR_INDIVIDUAL'],
    [ME_DEMONSTRACAO, 'COLABORADOR_DEMONSTRACAO'],
  ] as const)('identifica %j como %s', async (me, tipo) => {
    responder({ '/api/me': () => json(me) })
    renderizar()
    await entrar(ANA)
    expect(sessaoAtual().tipoConta).toBe(tipo)
  })

  it('401 no login resulta em credenciais inválidas, não em sessão expirada, sem retentativa', async () => {
    responder({ '/api/me': () => problema(401, 'AUTENTICACAO_NECESSARIA') })
    renderizar()

    expect(await entrar(ANA)).toEqual({ ok: false, motivo: 'credenciais-invalidas' })

    expect(estadoVisivel()).toBe('anonimo:inicial')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejeita nome de usuário inválido sem chamar a API', async () => {
    renderizar()
    expect(await entrar({ nomeUsuario: 'ana:x', senha: 'qualquer-senha' })).toEqual({
      ok: false,
      motivo: 'credenciais-invalidas',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['falha de rede', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['502', () => problema(502, 'IA_RESPOSTA_INVALIDA')],
    ['503', () => new Response(null, { status: 503 })],
    ['504', () => new Response(null, { status: 504 })],
  ] as const)('%s resulta em serviço indisponível', async (_caso, resposta) => {
    responder({ '/api/me': resposta })
    renderizar()
    expect(await entrar(ANA)).toEqual({ ok: false, motivo: 'servico-indisponivel' })
    expect(estadoVisivel()).toBe('anonimo:inicial')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('tempo limite resulta em serviço indisponível', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}))
    renderizar()
    const pendente = iniciarLogin(ANA)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    expect(await pendente).toEqual({ ok: false, motivo: 'servico-indisponivel' })
    expect(estadoVisivel()).toBe('anonimo:inicial')
  })

  it.each([
    ['ADMIN com colaboradorId', () => json({ nomeUsuario: 'ana', perfil: 'ADMIN', colaboradorId: 1 })],
    ['perfil desconhecido', () => json({ nomeUsuario: 'ana', perfil: 'GESTOR' })],
    ['HTML', () => new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } })],
    ['403 inesperado', () => problema(403, 'ACESSO_NEGADO')],
  ] as const)('%s resulta em resposta inválida', async (_caso, resposta) => {
    responder({ '/api/me': resposta })
    renderizar()
    expect(await entrar(ANA)).toEqual({ ok: false, motivo: 'resposta-invalida' })
    expect(estadoVisivel()).toBe('anonimo:inicial')
  })

  it('mostra o estado intermediário durante a autenticação', async () => {
    const me = adiado<Response>()
    responder({ '/api/me': () => me.promessa })
    renderizar()
    const pendente = iniciarLogin(ANA)
    expect(estadoVisivel()).toBe('autenticando')
    me.resolver(json(ME_ADMIN))
    await act(async () => {
      await pendente
    })
    expect(estadoVisivel()).toBe('autenticado:ana:ADMIN')
  })
})

describe('logout e cache', () => {
  it('cancela requisições, encerra a sessão e limpa queries e mutations', async () => {
    responder({ '/api/me': () => json(ME_ADMIN), '/api/cursos': () => new Promise<Response>(() => {}) })
    const { queryClient } = renderizar({ comCursos: true })
    await entrar(ANA)
    await esvaziar()
    const { api } = sessaoAtual()
    await queryClient.getMutationCache().build(queryClient, { mutationFn: () => Promise.resolve(1) }).execute(undefined)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1)
    expect(queryClient.getMutationCache().getAll()).toHaveLength(1)
    const sinalCursos = requisicoes().find((r) => r.url === '/api/cursos')?.sinal

    act(() => auth().sair())

    expect(estadoVisivel()).toBe('anonimo:logout')
    expect(sinalCursos?.aborted).toBe(true)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
    expect(api.encerrada).toBe(true)
    const chamadasAntes = fetchMock.mock.calls.length
    await expect(api.obter('/api/me', aceitar)).rejects.toMatchObject({ tipo: 'cancelado' })
    expect(fetchMock).toHaveBeenCalledTimes(chamadasAntes)
    expect(screen.queryByTestId('cursos')).toBeNull()
  })

  it('continuações atrasadas não recriam dados privados no cache', async () => {
    responder({ '/api/me': () => json(ME_ADMIN) })
    const { queryClient } = renderizar()
    await entrar(ANA)
    const chave = ['sessao', sessaoAtual().geracao] as const
    const atrasada = adiado<string>()
    // O logout cancela esta consulta, e o TanStack Query rejeita com CancelledError.
    const consulta = queryClient
      .fetchQuery({ queryKey: [...chave, 'privado'], queryFn: () => atrasada.promessa })
      .catch((erro: unknown) => erro)

    act(() => auth().sair())
    // Gravação tardia sob o prefixo antigo, logo após o logout.
    queryClient.setQueryData([...chave, 'tardio'], 'dado privado')
    atrasada.resolver('dado privado')
    await esvaziar()

    expect(queryClient.getQueryData([...chave, 'privado'])).toBeUndefined()
    expect(queryClient.getQueryData([...chave, 'tardio'])).toBeUndefined()
    expect(queryClient.getQueryCache().findAll({ queryKey: chave })).toHaveLength(0)
    expect(await consulta).toMatchObject({ revert: true })
  })
})

describe('401 e 403 durante o uso', () => {
  it('401 encerra a sessão como expirada, limpa o cache e preserva o erro original', async () => {
    responder({ '/api/me': () => json(ME_ADMIN), '/api/cursos': () => problema(401, 'AUTENTICACAO_NECESSARIA') })
    const { queryClient } = renderizar()
    await entrar(ANA)
    queryClient.setQueryData(['sessao', sessaoAtual().geracao, 'x'], 'privado')
    const { api } = sessaoAtual()

    let erro: unknown
    await act(async () => {
      erro = await api.obter('/api/cursos', aceitar).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ tipo: 'http', status: 401, codigo: 'AUTENTICACAO_NECESSARIA' })
    expect(estadoVisivel()).toBe('anonimo:sessao-expirada')
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(api.encerrada).toBe(true)
  })

  it('401 em uma query encerra a sessão uma única vez', async () => {
    responder({ '/api/me': () => json(ME_ADMIN), '/api/cursos': () => problema(401, 'AUTENTICACAO_NECESSARIA') })
    const { queryClient } = renderizar({ comCursos: true })
    await entrar(ANA)
    await esvaziar()

    expect(estadoVisivel()).toBe('anonimo:sessao-expirada')
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/cursos')).toHaveLength(1)
  })

  it.each(['ACESSO_NEGADO', 'CONSENTIMENTO_IA_NECESSARIO'])('403 %s não encerra a sessão', async (codigo) => {
    responder({ '/api/me': () => json(ME_ADMIN), '/api/cursos': () => problema(403, codigo) })
    const { queryClient } = renderizar({ comCursos: true })
    await entrar(ANA)
    await esvaziar()

    expect(screen.getByTestId('cursos').textContent).toBe('error')
    expect(estadoVisivel()).toBe('autenticado:ana:ADMIN')
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1)
    expect(sessaoAtual().api.encerrada).toBe(false)
  })
})

describe('concorrência', () => {
  it('logins concorrentes: vale o último, mesmo com resposta anterior atrasada', async () => {
    const meAna = adiado<Response>()
    responder({ '/api/me': (autorizacao) => (autorizacao === BASIC_ANA ? meAna.promessa : json(ME_INDIVIDUAL)) })
    renderizar()

    const loginAna = iniciarLogin(ANA)
    expect(await entrar(BRUNO)).toEqual({ ok: true })
    meAna.resolver(json(ME_ADMIN))

    expect(await loginAna).toEqual({ ok: false, motivo: 'cancelado' })
    await esvaziar()
    expect(estadoVisivel()).toBe('autenticado:bruno:COLABORADOR_INDIVIDUAL')
    expect(requisicoes()[0]?.sinal?.aborted).toBe(true)
  })

  it('logins concorrentes: a resposta antiga que chega primeiro também é ignorada', async () => {
    const meAna = adiado<Response>()
    const meBruno = adiado<Response>()
    responder({ '/api/me': (autorizacao) => (autorizacao === BASIC_ANA ? meAna.promessa : meBruno.promessa) })
    renderizar()

    const loginAna = iniciarLogin(ANA)
    const loginBruno = iniciarLogin(BRUNO)
    meAna.resolver(json(ME_ADMIN))
    expect(await loginAna).toEqual({ ok: false, motivo: 'cancelado' })
    expect(estadoVisivel()).toBe('autenticando')

    meBruno.resolver(json(ME_INDIVIDUAL))
    await act(async () => {
      expect(await loginBruno).toEqual({ ok: true })
    })
    expect(estadoVisivel()).toBe('autenticado:bruno:COLABORADOR_INDIVIDUAL')
  })

  it('logout durante o login cancela a tentativa e ignora a resposta tardia', async () => {
    const me = adiado<Response>()
    responder({ '/api/me': () => me.promessa })
    renderizar()

    const login = iniciarLogin(ANA)
    act(() => auth().sair())
    me.resolver(json(ME_ADMIN))

    expect(await login).toEqual({ ok: false, motivo: 'cancelado' })
    await esvaziar()
    expect(estadoVisivel()).toBe('anonimo:logout')
    expect(requisicoes()[0]?.sinal?.aborted).toBe(true)
  })

  it('logout durante o login com 401 tardio não vira sessão expirada', async () => {
    const me = adiado<Response>()
    responder({ '/api/me': () => me.promessa })
    renderizar()

    const login = iniciarLogin(ANA)
    act(() => auth().sair())
    me.resolver(problema(401, 'AUTENTICACAO_NECESSARIA'))

    expect(await login).toEqual({ ok: false, motivo: 'cancelado' })
    await esvaziar()
    expect(estadoVisivel()).toBe('anonimo:logout')
  })

  it('troca de usuário limpa o cache e encerra a sessão anterior antes da nova', async () => {
    const meBruno = adiado<Response>()
    responder({
      '/api/me': (autorizacao) => (autorizacao === BASIC_ANA ? json(ME_ADMIN) : meBruno.promessa),
      '/api/cursos': () => json([{ id: 1, nome: 'Privado da Ana' }]),
    })
    const { queryClient } = renderizar({ comCursos: true })
    await entrar(ANA)
    await esvaziar()
    const sessaoAna = sessaoAtual()
    expect(queryClient.getQueryData(['sessao', sessaoAna.geracao, 'cursos'])).toBeDefined()

    const loginBruno = iniciarLogin(BRUNO)

    expect(estadoVisivel()).toBe('autenticando')
    expect(sessaoAna.api.encerrada).toBe(true)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)

    meBruno.resolver(json(ME_INDIVIDUAL))
    await act(async () => {
      await loginBruno
    })
    await esvaziar()
    const sessaoBruno = sessaoAtual()
    expect(sessaoBruno.identidade.nomeUsuario).toBe('bruno')
    expect(sessaoBruno.geracao).not.toBe(sessaoAna.geracao)
    expect(queryClient.getQueryData(['sessao', sessaoAna.geracao, 'cursos'])).toBeUndefined()
    const cursos = requisicoes().filter((r) => r.url === '/api/cursos')
    expect(cursos.map((r) => r.autorizacao)).toEqual([BASIC_ANA, BASIC_BRUNO])
  })

  it('401 atrasado da sessão anterior não derruba a sessão atual', async () => {
    const cursosAna = adiado<Response>()
    responder({
      '/api/me': (autorizacao) => json(autorizacao === BASIC_ANA ? ME_ADMIN : ME_INDIVIDUAL),
      '/api/cursos': () => cursosAna.promessa,
    })
    renderizar()
    await entrar(ANA)
    const { api: apiAna } = sessaoAtual()
    const pedidoAna = apiAna.obter('/api/cursos', aceitar).catch((e: unknown) => e)

    await entrar(BRUNO)
    cursosAna.resolver(problema(401, 'AUTENTICACAO_NECESSARIA'))

    expect(await pedidoAna).toMatchObject({ tipo: 'cancelado' })
    await esvaziar()
    expect(estadoVisivel()).toBe('autenticado:bruno:COLABORADOR_INDIVIDUAL')
  })

  it('depois de expirar por 401, um novo login funciona normalmente', async () => {
    responder({
      '/api/me': (autorizacao) => json(autorizacao === BASIC_ANA ? ME_ADMIN : ME_INDIVIDUAL),
      '/api/cursos': (autorizacao) => (autorizacao === BASIC_ANA ? problema(401, 'AUTENTICACAO_NECESSARIA') : json([])),
    })
    renderizar({ comCursos: true })
    await entrar(ANA)
    await esvaziar()
    expect(estadoVisivel()).toBe('anonimo:sessao-expirada')

    expect(await entrar(BRUNO)).toEqual({ ok: true })
    await esvaziar()
    expect(estadoVisivel()).toBe('autenticado:bruno:COLABORADOR_INDIVIDUAL')
    expect(screen.getByTestId('cursos').textContent).toBe('success')
  })
})

describe('StrictMode e desmontagem', () => {
  it('sob StrictMode, o login faz uma única chamada e autentica', async () => {
    responder({ '/api/me': () => json(ME_INDIVIDUAL) })
    renderizar({ strict: true })
    expect(estadoVisivel()).toBe('anonimo:inicial')

    expect(await entrar(BRUNO)).toEqual({ ok: true })

    expect(estadoVisivel()).toBe('autenticado:bruno:COLABORADOR_INDIVIDUAL')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sob StrictMode, a query da sessão roda e o logout limpa tudo', async () => {
    responder({ '/api/me': () => json(ME_ADMIN), '/api/cursos': () => json([]) })
    const { queryClient } = renderizar({ strict: true, comCursos: true })
    await entrar(ANA)
    await esvaziar()
    expect(screen.getByTestId('cursos').textContent).toBe('success')

    act(() => auth().sair())
    expect(estadoVisivel()).toBe('anonimo:logout')
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('desmontar o provider encerra a sessão e aborta as requisições', async () => {
    responder({ '/api/me': () => json(ME_ADMIN), '/api/cursos': () => new Promise<Response>(() => {}) })
    const { unmount, queryClient } = renderizar({ comCursos: true })
    await entrar(ANA)
    await esvaziar()
    const { api } = sessaoAtual()
    const sinalCursos = requisicoes().find((r) => r.url === '/api/cursos')?.sinal

    unmount()

    expect(api.encerrada).toBe(true)
    expect(sinalCursos?.aborted).toBe(true)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('login pendente durante a desmontagem resolve como cancelado', async () => {
    const me = adiado<Response>()
    responder({ '/api/me': () => me.promessa })
    const { unmount } = renderizar()
    const login = iniciarLogin(ANA)
    unmount()
    me.resolver(json(ME_ADMIN))
    expect(await login).toEqual({ ok: false, motivo: 'cancelado' })
  })
})

describe('privacidade', () => {
  it('não persiste, não registra e não expõe credenciais', async () => {
    const armazenamento = [vi.spyOn(Storage.prototype, 'setItem'), vi.spyOn(Storage.prototype, 'getItem')]
    const consoles = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m))
    responder({ '/api/me': () => json(ME_ADMIN) })
    renderizar()

    await entrar(ANA)
    act(() => auth().sair())
    await entrar(ANA)

    for (const espiao of [...armazenamento, ...consoles]) {
      expect(espiao).not.toHaveBeenCalled()
    }
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    expect(document.body.textContent).not.toContain(ANA.senha)
    const { identidade, tipoConta, geracao } = sessaoAtual()
    const estadoSemApi = { identidade, tipoConta, geracao }
    expect(JSON.stringify(estadoSemApi)).not.toContain(ANA.senha)
    expect(JSON.stringify(estadoSemApi)).not.toContain(BASIC_ANA)
  })

  it('useAuth e useSessaoApi exigem provider e sessão', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function SemProvider() {
      useAuth()
      return null
    }
    function SemSessao() {
      useSessaoApi()
      return null
    }
    expect(() => render(<SemProvider />)).toThrow('useAuth precisa estar dentro de <AuthProvider>.')
    expect(() =>
      render(
        <QueryClientProvider client={criarQueryClient()}>
          <AuthProvider>
            <SemSessao />
          </AuthProvider>
        </QueryClientProvider>,
      ),
    ).toThrow('useSessaoApi exige uma sessão autenticada.')
  })
})
