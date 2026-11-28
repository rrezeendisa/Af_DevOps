import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { StrictMode, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarQueryClient } from '@/app/queryClient'
import { responderJson as json, responderProblema as problema, servidorSimulado } from '@/test/servidor'
import { ApiError } from '@/lib/api/erros'
import { AuthProvider } from './AuthProvider'
import { useAuth, useSessaoApi, type ResultadoLogin, type ValorAuth } from './contexto'
import { CHAVE_SAIDA_PENDENTE } from './saidaPendente'

// Respostas simuladas existem somente nestes testes.

const ANA = { nomeUsuario: 'ana', senha: 'senha-da-ana-çã€1' }
const BRUNO = { nomeUsuario: 'bruno', senha: 'senha-do-bruno-123' }
const DEMO = { nomeUsuario: 'colab.demo', senha: 'senha-da-demo-123' }
const ME_ADMIN = { nomeUsuario: 'ana', perfil: 'ADMIN' }
const ME_INDIVIDUAL = { nomeUsuario: 'bruno', perfil: 'COLABORADOR', colaboradorId: 7 }
const ME_DEMONSTRACAO = { nomeUsuario: 'colab.demo', perfil: 'COLABORADOR' }

const fetchMock = vi.fn<typeof fetch>()

function adiado<T>() {
  let resolver: (valor: T) => void = () => {}
  const promessa = new Promise<T>((r) => {
    resolver = r
  })
  return { promessa, resolver }
}

let servidor: ReturnType<typeof servidorSimulado>

/** Servidor com as contas informadas. `me` permite violar o contrato nos testes. */
function simular(me: { ana?: unknown; bruno?: unknown } = {}) {
  servidor = servidorSimulado(fetchMock, {
    ana: { me: (me.ana ?? ME_ADMIN) as Record<string, unknown>, senha: ANA.senha },
    bruno: { me: (me.bruno ?? ME_INDIVIDUAL) as Record<string, unknown>, senha: BRUNO.senha },
    'colab.demo': { me: ME_DEMONSTRACAO, senha: DEMO.senha },
  })
  return servidor
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

/** Renderiza e espera a consulta de restauração terminar, esquecendo as chamadas dela. */
async function abrir(opcoes: Parameters<typeof renderizar>[0] = {}) {
  const resultado = renderizar(opcoes)
  await vi.waitFor(() => expect(estadoVisivel()).not.toBe('verificando'))
  servidor.chamadas.length = 0
  return resultado
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

/** Pede o logout e espera o servidor responder. */
async function sair(estadoEsperado = 'anonimo:logout') {
  act(() => auth().sair())
  await waitFor(() => expect(estadoVisivel()).toBe(estadoEsperado))
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
  localStorage.clear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  simular()
  sonda.auth = null
})

afterEach(() => {
  // Desmonta antes de remover o fetch simulado, para nenhuma aba continuar pedindo.
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('login', () => {
  it('autentica com CSRF, POST /api/login e GET /api/me, sem Authorization', async () => {
    await abrir()
    expect(estadoVisivel()).toBe('anonimo:inicial')

    expect(await entrar(ANA)).toEqual({ ok: true })

    expect(estadoVisivel()).toBe('autenticado:ana:ADMIN')
    expect(servidor.rotas()).toEqual(['GET /api/me', 'GET /api/csrf', 'POST /api/login', 'GET /api/me'])
    expect(servidor.da('POST /api/login')[0]?.csrf).toBe('tokenCsrfDeTeste')
    expect(servidor.chamadas.filter((c) => c.corpo?.includes('password'))).toHaveLength(1)
  })

  it.each([
    [ANA, 'ADMIN'],
    [BRUNO, 'COLABORADOR_INDIVIDUAL'],
    [DEMO, 'COLABORADOR_DEMONSTRACAO'],
  ] as const)('identifica a conta de %j como %s', async (credenciais, tipo) => {
    await abrir()
    await entrar(credenciais)
    expect(sessaoAtual().tipoConta).toBe(tipo)
  })

  it('401 no login resulta em credenciais inválidas, não em sessão expirada, sem retentativa', async () => {
    await abrir()

    expect(await entrar({ ...ANA, senha: 'errada' })).toEqual({ ok: false, motivo: 'credenciais-invalidas' })

    expect(estadoVisivel()).toBe('anonimo:inicial')
    expect(servidor.da('POST /api/login')).toHaveLength(1)
  })

  it('429 resulta em muitas tentativas, sem retentativa', async () => {
    servidor.interceptar('POST /api/login', () => new Response(null, { status: 429 }))
    await abrir()
    expect(await entrar(ANA)).toEqual({ ok: false, motivo: 'muitas-tentativas' })
    expect(servidor.da('POST /api/login')).toHaveLength(1)
  })

  it('CSRF recusado no login não autentica nem repete', async () => {
    servidor.interceptar('POST /api/login', () => problema(403, 'CSRF_INVALIDO'))
    await abrir()
    expect(await entrar(ANA)).toEqual({ ok: false, motivo: 'resposta-invalida' })
    expect(servidor.da('POST /api/login')).toHaveLength(1)
    expect(estadoVisivel()).toBe('anonimo:inicial')
  })

  it('rejeita nome de usuário inválido sem chamar a API', async () => {
    await abrir()
    expect(await entrar({ nomeUsuario: 'ana:x', senha: 'qualquer-senha' })).toEqual({
      ok: false,
      motivo: 'credenciais-invalidas',
    })
    expect(servidor.chamadas).toHaveLength(0)
  })

  it.each([
    ['falha de rede', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['502', () => problema(502, 'IA_RESPOSTA_INVALIDA')],
    ['503', () => new Response(null, { status: 503 })],
    ['504', () => new Response(null, { status: 504 })],
  ] as const)('%s resulta em serviço indisponível', async (_caso, resposta) => {
    await abrir()
    servidor.interceptar('POST /api/login', resposta)
    expect(await entrar(ANA)).toEqual({ ok: false, motivo: 'servico-indisponivel' })
    expect(estadoVisivel()).toBe('anonimo:inicial')
    expect(servidor.da('POST /api/login')).toHaveLength(1)
  })

  it('tempo limite resulta em serviço indisponível', async () => {
    await abrir()
    vi.useFakeTimers()
    servidor.interceptar('POST /api/login', () => new Promise<Response>(() => {}))
    const pendente = iniciarLogin(ANA)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    expect(await pendente).toEqual({ ok: false, motivo: 'servico-indisponivel' })
    expect(estadoVisivel()).toBe('anonimo:inicial')
  })

  it.each([
    ['ADMIN com colaboradorId', () => json({ nomeUsuario: 'ana', perfil: 'ADMIN', colaboradorId: 1 }, 200, { 'X-Evolia-Contexto': 'c' })],
    ['perfil desconhecido', () => json({ nomeUsuario: 'ana', perfil: 'GESTOR' }, 200, { 'X-Evolia-Contexto': 'c' })],
    ['identidade de outro usuário', () => json(ME_INDIVIDUAL, 200, { 'X-Evolia-Contexto': 'c' })],
    ['sem contexto', () => json(ME_ADMIN)],
    ['HTML', () => new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } })],
    ['403 inesperado', () => problema(403, 'ACESSO_NEGADO')],
  ] as const)('%s resulta em resposta inválida', async (_caso, resposta) => {
    await abrir()
    // Só a leitura posterior ao login é adulterada.
    servidor.interceptar('GET /api/me', () => (servidor.atual ? resposta() : undefined))
    expect(await entrar(ANA)).toEqual({ ok: false, motivo: 'resposta-invalida' })
    expect(estadoVisivel()).toBe('anonimo:inicial')
  })

  it('mostra o estado intermediário durante a autenticação', async () => {
    await abrir()
    const resposta = adiado<Response>()
    servidor.interceptar('POST /api/login', () => resposta.promessa)
    const pendente = iniciarLogin(ANA)
    expect(estadoVisivel()).toBe('autenticando')
    await vi.waitFor(() => expect(servidor.da('POST /api/login')).toHaveLength(1))
    resposta.resolver(servidor.processar(servidor.da('POST /api/login')[0]!))
    await act(async () => {
      await pendente
    })
    expect(estadoVisivel()).toBe('autenticado:ana:ADMIN')
  })
})

describe('restauração', () => {
  it('restaura a sessão válida do navegador, sem pedir senha nem CSRF', async () => {
    servidor.abrir('ana')
    renderizar()
    expect(estadoVisivel()).toBe('verificando')
    await waitFor(() => expect(estadoVisivel()).toBe('autenticado:ana:ADMIN'))
    expect(servidor.rotas()).toEqual(['GET /api/me'])
    expect(servidor.chamadas[0]?.contexto).toBeNull()
  })

  it('sob StrictMode restaura uma única identidade', async () => {
    servidor.abrir('bruno')
    renderizar({ strict: true })
    await waitFor(() => expect(estadoVisivel()).toBe('autenticado:bruno:COLABORADOR_INDIVIDUAL'))
  })

  it.each([
    ['sem sessão', undefined],
    ['sessão expirada', () => problema(401, 'AUTENTICACAO_NECESSARIA')],
    ['serviço indisponível', () => new Response(null, { status: 503 })],
  ] as const)('%s termina anônima', async (_caso, resposta) => {
    if (resposta) servidor.interceptar('GET /api/me', resposta)
    renderizar()
    await waitFor(() => expect(estadoVisivel()).toBe('anonimo:inicial'))
  })

  it('resposta atrasada da restauração não sobrepõe um login posterior', async () => {
    servidor.abrir('ana')
    const atrasada = adiado<Response>()
    let primeira = true
    servidor.interceptar('GET /api/me', () => {
      if (!primeira) return undefined
      primeira = false
      return atrasada.promessa
    })
    renderizar()

    expect(await entrar(BRUNO)).toEqual({ ok: true })
    atrasada.resolver(json(ME_ADMIN, 200, { 'X-Evolia-Contexto': 'contexto-antigo' }))
    await esvaziar()

    expect(estadoVisivel()).toBe('autenticado:bruno:COLABORADOR_INDIVIDUAL')
  })
})

describe('logout e cache', () => {
  it('cancela requisições, encerra a sessão e limpa queries e mutations', async () => {
    servidor.interceptar('GET /api/cursos', () => new Promise<Response>(() => {}))
    const { queryClient } = await abrir({ comCursos: true })
    await entrar(ANA)
    await esvaziar()
    const { api } = sessaoAtual()
    await queryClient.getMutationCache().build(queryClient, { mutationFn: () => Promise.resolve(1) }).execute(undefined)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1)
    expect(queryClient.getMutationCache().getAll()).toHaveLength(1)
    const sinalCursos = servidor.da('GET /api/cursos')[0]?.sinal

    act(() => auth().sair())

    // O estado local some na hora; a saída só é declarada depois da confirmação do servidor.
    expect(estadoVisivel()).toBe('saindo')
    expect(sinalCursos?.aborted).toBe(true)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
    expect(api.encerrada).toBe(true)
    await waitFor(() => expect(estadoVisivel()).toBe('anonimo:logout'))
    expect(servidor.atual).toBeNull()
    expect(localStorage.length).toBe(0)
    const chamadasAntes = fetchMock.mock.calls.length
    await expect(api.obter('/api/me', aceitar)).rejects.toMatchObject({ tipo: 'cancelado' })
    expect(fetchMock).toHaveBeenCalledTimes(chamadasAntes)
    expect(screen.queryByTestId('cursos')).toBeNull()
  })

  it('continuações atrasadas não recriam dados privados no cache', async () => {
    const { queryClient } = await abrir()
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
  it.each([
    ['AUTENTICACAO_NECESSARIA', 'anonimo:sessao-expirada'],
    ['SESSAO_SUBSTITUIDA', 'anonimo:sessao-substituida'],
  ])('401 %s encerra a sessão, limpa o cache e preserva o erro original', async (codigo, esperado) => {
    servidor.interceptar('GET /api/cursos', () => problema(401, codigo))
    const { queryClient } = await abrir()
    await entrar(ANA)
    queryClient.setQueryData(['sessao', sessaoAtual().geracao, 'x'], 'privado')
    const { api } = sessaoAtual()

    let erro: unknown
    await act(async () => {
      erro = await api.obter('/api/cursos', aceitar).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ tipo: 'http', status: 401, codigo })
    expect(estadoVisivel()).toBe(esperado)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(api.encerrada).toBe(true)
  })

  it('401 em uma query encerra a sessão uma única vez', async () => {
    servidor.interceptar('GET /api/cursos', () => problema(401, 'AUTENTICACAO_NECESSARIA'))
    const { queryClient } = await abrir({ comCursos: true })
    await entrar(ANA)
    await esvaziar()

    expect(estadoVisivel()).toBe('anonimo:sessao-expirada')
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(servidor.da('GET /api/cursos')).toHaveLength(1)
  })

  it.each(['ACESSO_NEGADO', 'CONSENTIMENTO_IA_NECESSARIO', 'CSRF_INVALIDO'])(
    '403 %s não encerra a sessão',
    async (codigo) => {
      servidor.interceptar('GET /api/cursos', () => problema(403, codigo))
      const { queryClient } = await abrir({ comCursos: true })
      await entrar(ANA)
      await esvaziar()

      expect(screen.getByTestId('cursos').textContent).toBe('error')
      expect(estadoVisivel()).toBe('autenticado:ana:ADMIN')
      expect(queryClient.getQueryCache().getAll()).toHaveLength(1)
      expect(sessaoAtual().api.encerrada).toBe(false)
    },
  )
})

/** Segura a primeira resposta do login, sem processá-la ainda no servidor. */
function segurarLogin() {
  const liberar = adiado<void>()
  let primeiro = true
  servidor.interceptar('POST /api/login', (chamada) => {
    if (!primeiro) return undefined
    primeiro = false
    return liberar.promessa.then(() => servidor.processar(chamada))
  })
  return { liberar: () => liberar.resolver() }
}

const esperarLogins = (quantidade: number) =>
  vi.waitFor(() => expect(servidor.da('POST /api/login')).toHaveLength(quantidade))

describe('concorrência', () => {
  it('logins concorrentes: vale o último, e a sessão do primeiro é encerrada antes', async () => {
    await abrir()
    const primeiro = segurarLogin()

    const loginAna = iniciarLogin(ANA)
    await esperarLogins(1)
    const loginBruno = iniciarLogin(BRUNO)
    await esvaziar()
    // O segundo login espera: o cookie nunca é disputado.
    expect(servidor.da('POST /api/login')).toHaveLength(1)
    primeiro.liberar()

    expect(await loginAna).toEqual({ ok: false, motivo: 'cancelado' })
    await act(async () => {
      expect(await loginBruno).toEqual({ ok: true })
    })
    expect(estadoVisivel()).toBe('autenticado:bruno:COLABORADOR_INDIVIDUAL')
    expect(servidor.rotas().filter((r) => r.startsWith('POST'))).toEqual([
      'POST /api/login',
      'POST /api/logout',
      'POST /api/login',
    ])
  })

  it('logout durante o login encerra no servidor e ignora a resposta tardia', async () => {
    await abrir()
    const login1 = segurarLogin()
    const login = iniciarLogin(ANA)
    await esperarLogins(1)

    act(() => auth().sair())
    expect(estadoVisivel()).toBe('saindo')
    expect(localStorage.getItem(CHAVE_SAIDA_PENDENTE)).toBe('true')
    login1.liberar()

    expect(await login).toEqual({ ok: false, motivo: 'cancelado' })
    await waitFor(() => expect(estadoVisivel()).toBe('anonimo:logout'))
    expect(servidor.atual).toBeNull()
    expect(localStorage.getItem(CHAVE_SAIDA_PENDENTE)).toBeNull()
  })

  it('logout durante o login com 401 tardio não vira sessão expirada', async () => {
    await abrir()
    const resposta = adiado<Response>()
    servidor.interceptar('POST /api/login', () => resposta.promessa)
    const login = iniciarLogin(ANA)
    await esperarLogins(1)
    act(() => auth().sair())
    resposta.resolver(problema(401, 'AUTENTICACAO_NECESSARIA'))

    expect(await login).toEqual({ ok: false, motivo: 'cancelado' })
    await waitFor(() => expect(estadoVisivel()).toBe('anonimo:logout'))
  })

  it('troca de usuário limpa o cache e encerra a sessão anterior antes da nova', async () => {
    servidor.interceptar('GET /api/cursos', () => json([{ id: 1, nome: 'Privado' }]))
    const { queryClient } = await abrir({ comCursos: true })
    await entrar(ANA)
    await esvaziar()
    const sessaoAna = sessaoAtual()
    const contextoAna = servidor.atual?.contexto
    expect(queryClient.getQueryData(['sessao', sessaoAna.geracao, 'cursos'])).toBeDefined()
    servidor.chamadas.length = 0

    const loginBruno = iniciarLogin(BRUNO)

    expect(estadoVisivel()).toBe('autenticando')
    expect(sessaoAna.api.encerrada).toBe(true)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    await act(async () => {
      await loginBruno
    })
    await esvaziar()
    const sessaoBruno = sessaoAtual()
    expect(sessaoBruno.identidade.nomeUsuario).toBe('bruno')
    expect(sessaoBruno.geracao).not.toBe(sessaoAna.geracao)
    expect(queryClient.getQueryData(['sessao', sessaoAna.geracao, 'cursos'])).toBeUndefined()
    const rotas = servidor.rotas()
    expect(rotas.indexOf('POST /api/logout')).toBeGreaterThan(-1)
    expect(rotas.indexOf('POST /api/logout')).toBeLessThan(rotas.indexOf('POST /api/login'))
    expect(servidor.da('GET /api/cursos').map((c) => c.contexto)).toEqual([servidor.atual?.contexto])
    expect(servidor.atual?.contexto).not.toBe(contextoAna)
  })

  it('se a sessão anterior não puder ser encerrada, não autentica outro usuário', async () => {
    await abrir()
    await entrar(ANA)
    servidor.interceptar('POST /api/logout', () => new Response(null, { status: 503 }))
    servidor.chamadas.length = 0

    expect(await entrar(BRUNO)).toEqual({ ok: false, motivo: 'servico-indisponivel' })

    expect(servidor.da('POST /api/login')).toHaveLength(0)
    expect(servidor.atual?.usuario).toBe('ana')
    expect(estadoVisivel()).toBe('saida-pendente')
  })

  it('401 atrasado da sessão anterior não derruba a sessão atual', async () => {
    const cursosAna = adiado<Response>()
    servidor.interceptar('GET /api/cursos', () => cursosAna.promessa)
    await abrir()
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
    servidor.interceptar('GET /api/cursos', () => {
      if (servidor.atual?.usuario !== 'ana') return json([])
      servidor.atual = null
      return problema(401, 'AUTENTICACAO_NECESSARIA')
    })
    await abrir({ comCursos: true })
    await entrar(ANA)
    await esvaziar()
    expect(estadoVisivel()).toBe('anonimo:sessao-expirada')

    expect(await entrar(BRUNO)).toEqual({ ok: true })
    await esvaziar()
    expect(estadoVisivel()).toBe('autenticado:bruno:COLABORADOR_INDIVIDUAL')
    expect(screen.getByTestId('cursos').textContent).toBe('success')
  })
})

describe('logout sem confirmação', () => {
  const semRede = () => Promise.reject(new TypeError('Failed to fetch'))

  async function falharSaida() {
    await abrir()
    await entrar(ANA)
    servidor.interceptar('POST /api/logout', semRede)
    await sair('saida-pendente')
  }

  it('grava o marcador booleano antes de qualquer requisição de logout', async () => {
    await abrir()
    await entrar(ANA)
    const vistos: (string | null)[] = []
    for (const rota of ['GET /api/csrf', 'POST /api/logout']) {
      servidor.interceptar(rota, () => {
        vistos.push(localStorage.getItem(CHAVE_SAIDA_PENDENTE))
        return undefined
      })
    }
    act(() => auth().sair())
    expect(localStorage.getItem(CHAVE_SAIDA_PENDENTE)).toBe('true')
    await waitFor(() => expect(estadoVisivel()).toBe('anonimo:logout'))
    expect(vistos).toEqual(['true', 'true'])
    expect(localStorage.length).toBe(0)
  })

  it('não declara a saída e guarda somente o marcador', async () => {
    await falharSaida()
    expect(servidor.atual?.usuario).toBe('ana')
    expect(Object.entries(localStorage)).toEqual([[CHAVE_SAIDA_PENDENTE, 'true']])
    expect(sessionStorage.length).toBe(0)
    expect(servidor.da('POST /api/logout')).toHaveLength(1)
  })

  it('não restaura nem consulta a sessão depois de recarregar', async () => {
    await falharSaida()
    cleanup()
    servidor.chamadas.length = 0

    renderizar({ comCursos: true })
    await esvaziar()

    expect(estadoVisivel()).toBe('saida-pendente')
    expect(screen.queryByTestId('cursos')).toBeNull()
    expect(servidor.chamadas).toHaveLength(0)
  })

  it('repetir na mesma página encerra com o contexto conhecido e remove o marcador', async () => {
    await falharSaida()
    servidor.liberar('POST /api/logout')
    await sair()
    expect(servidor.atual).toBeNull()
    expect(localStorage.length).toBe(0)
  })

  it('repetir depois de recarregar lê o contexto, encerra e remove o marcador', async () => {
    await falharSaida()
    cleanup()
    servidor.liberar('POST /api/logout')
    renderizar()
    await sair()
    expect(servidor.atual).toBeNull()
    expect(localStorage.length).toBe(0)
  })

  it('se o servidor disser que não há sessão, remove o marcador', async () => {
    await falharSaida()
    cleanup()
    servidor.atual = null
    servidor.chamadas.length = 0
    renderizar()
    await sair()
    expect(servidor.rotas()).toEqual(['GET /api/me'])
    expect(localStorage.length).toBe(0)
  })

  it('tentativa antiga não encerra a sessão de outro usuário', async () => {
    await falharSaida()
    servidor.liberar('POST /api/logout')
    // Outra aba entrou: encerrou o que havia, removeu o marcador e criou a sessão do Bruno.
    localStorage.removeItem(CHAVE_SAIDA_PENDENTE)
    servidor.abrir('bruno')
    servidor.chamadas.length = 0

    await sair()

    expect(servidor.atual?.usuario).toBe('bruno')
    expect(servidor.chamadas).toHaveLength(0)
  })

  it('marcador removido enquanto a identidade é lida: o logout não é enviado', async () => {
    await falharSaida()
    cleanup()
    servidor.liberar('POST /api/logout')
    servidor.interceptar('GET /api/me', () => {
      localStorage.removeItem(CHAVE_SAIDA_PENDENTE)
      servidor.abrir('bruno')
      return undefined
    })
    servidor.chamadas.length = 0
    renderizar()
    await sair()
    expect(servidor.da('POST /api/logout')).toHaveLength(0)
    expect(servidor.atual?.usuario).toBe('bruno')
  })

  it('sessão substituída entre a falha e a repetição não é encerrada pelo contexto antigo', async () => {
    await falharSaida()
    servidor.liberar('POST /api/logout')
    servidor.abrir('bruno')

    await sair('saida-pendente')

    expect(servidor.atual?.usuario).toBe('bruno')
  })

  it('CSRF recusado no logout mantém a saída pendente', async () => {
    await abrir()
    await entrar(ANA)
    servidor.interceptar('POST /api/logout', () => problema(403, 'CSRF_INVALIDO'))
    await sair('saida-pendente')
    expect(servidor.da('POST /api/logout')).toHaveLength(1)
  })

  it('um novo login encerra primeiro a sessão pendente e remove o marcador', async () => {
    await falharSaida()
    servidor.liberar('POST /api/logout')
    expect(await entrar(BRUNO)).toEqual({ ok: true })
    expect(localStorage.length).toBe(0)
    expect(servidor.atual?.usuario).toBe('bruno')
  })
})

describe('sem localStorage', () => {
  function bloquearArmazenamento() {
    for (const metodo of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, metodo).mockImplementation(() => {
        throw new DOMException('bloqueado', 'SecurityError')
      })
    }
  }

  it('pede confirmação antes de restaurar', async () => {
    bloquearArmazenamento()
    servidor.abrir('ana')
    renderizar({ comCursos: true })
    await waitFor(() => expect(estadoVisivel()).toBe('confirmar'))
    expect(screen.queryByTestId('cursos')).toBeNull()
    expect(servidor.da('GET /api/cursos')).toHaveLength(0)

    servidor.interceptar('GET /api/cursos', () => json([]))
    act(() => auth().continuar())
    expect(estadoVisivel()).toBe('autenticado:ana:ADMIN')
  })

  it('permite sair em vez de continuar', async () => {
    bloquearArmazenamento()
    servidor.abrir('ana')
    renderizar()
    await waitFor(() => expect(estadoVisivel()).toBe('confirmar'))
    await sair()
    expect(servidor.atual).toBeNull()
  })

  it('logout sem confirmação continua pendente enquanto a página existir', async () => {
    bloquearArmazenamento()
    await abrir()
    await entrar(ANA)
    servidor.interceptar('POST /api/logout', () => new Response(null, { status: 503 }))
    await sair('saida-pendente')
    servidor.liberar('POST /api/logout')
    await sair()
    expect(servidor.atual).toBeNull()
  })
})

describe('múltiplas abas', () => {
  /** Duas aplicações independentes sobre o mesmo "navegador". */
  function aba() {
    const ref: { auth: ValorAuth | null } = { auth: null }
    function Espiar() {
      const valor = useAuth()
      useEffect(() => {
        ref.auth = valor
      })
      return null
    }
    const queryClient = criarQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Espiar />
        </AuthProvider>
      </QueryClientProvider>,
    )
    const atual = () => {
      const estado = ref.auth!.estado
      if (estado.status === 'autenticado') return `autenticado:${estado.identidade.nomeUsuario}`
      return estado.status === 'anonimo' ? `anonimo:${estado.motivo}` : estado.status
    }
    return { queryClient, atual, auth: () => ref.auth! }
  }

  async function duasAbasComAna() {
    servidor.abrir('ana')
    const a = aba()
    const b = aba()
    await waitFor(() => expect([a.atual(), b.atual()]).toEqual(['autenticado:ana', 'autenticado:ana']))
    return { a, b }
  }

  it('o canal transmite somente o sinal, sem dados', async () => {
    const enviados: unknown[] = []
    const espiao = vi.spyOn(BroadcastChannel.prototype, 'postMessage').mockImplementation((m) => void enviados.push(m))
    await abrir()
    await entrar(ANA)
    await entrar(BRUNO)
    await sair()
    expect(espiao).toHaveBeenCalled()
    expect(new Set(enviados)).toEqual(new Set(['sessao-alterada']))
  })

  it('troca de usuário em uma aba descarta a outra, sem adotar a nova identidade', async () => {
    const { a, b } = await duasAbasComAna()
    b.queryClient.setQueryData(['sessao', 1, 'x'], 'privado')

    await act(async () => {
      await a.auth().entrar(BRUNO)
    })

    await waitFor(() => expect(b.atual()).toBe('anonimo:sessao-substituida'))
    expect(a.atual()).toBe('autenticado:bruno')
    expect(b.queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('logout em uma aba encerra a outra', async () => {
    const { a, b } = await duasAbasComAna()
    act(() => a.auth().sair())
    await waitFor(() => expect(a.atual()).toBe('anonimo:logout'))
    await waitFor(() => expect(b.atual()).not.toMatch(/autenticado|saida-pendente/))
  })

  it('logout sem confirmação bloqueia as duas abas, e a confirmação libera', async () => {
    const { a, b } = await duasAbasComAna()
    servidor.interceptar('POST /api/logout', () => new Response(null, { status: 503 }))
    act(() => a.auth().sair())
    await waitFor(() => expect([a.atual(), b.atual()]).toEqual(['saida-pendente', 'saida-pendente']))

    servidor.liberar('POST /api/logout')
    act(() => a.auth().sair())
    await waitFor(() => expect([a.atual(), b.atual()]).toEqual(['anonimo:logout', 'anonimo:logout']))
  })

  it('o evento de armazenamento sincroniza mesmo sem o canal', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    servidor.abrir('ana')
    const a = aba()
    await waitFor(() => expect(a.atual()).toBe('autenticado:ana'))

    localStorage.setItem(CHAVE_SAIDA_PENDENTE, 'true')
    const evento = { key: CHAVE_SAIDA_PENDENTE, newValue: 'true' }
    act(() => void window.dispatchEvent(new StorageEvent('storage', evento)))

    expect(a.atual()).toBe('saida-pendente')
  })

  it.each([
    ['gravação do teste', { oldValue: null, newValue: 'false' }],
    ['remoção do teste', { oldValue: 'false', newValue: null }],
  ])('a %s feita por outra aba ao restaurar não encerra esta', async (_caso, valores) => {
    servidor.abrir('ana')
    const a = aba()
    await waitFor(() => expect(a.atual()).toBe('autenticado:ana'))

    act(() => void window.dispatchEvent(new StorageEvent('storage', { key: CHAVE_SAIDA_PENDENTE, ...valores })))

    expect(a.atual()).toBe('autenticado:ana')
  })

  it('sem BroadcastChannel, o servidor ainda impede a aba antiga de usar a nova identidade', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const { a, b } = await duasAbasComAna()
    await act(async () => {
      await a.auth().entrar(BRUNO)
    })
    const antiga = b.auth().estado
    if (antiga.status !== 'autenticado') throw new Error('A aba antiga ainda não sabe da troca.')

    let erro: unknown
    await act(async () => {
      erro = await antiga.api.obter('/api/me', aceitar).catch((e: unknown) => e)
    })

    expect(erro).toMatchObject({ status: 401, codigo: 'SESSAO_SUBSTITUIDA' })
    expect(b.atual()).toBe('anonimo:sessao-substituida')
    expect(a.atual()).toBe('autenticado:bruno')
  })
})

describe('StrictMode e desmontagem', () => {
  it('sob StrictMode, o login faz uma única chamada e autentica', async () => {
    await abrir({ strict: true })
    expect(estadoVisivel()).toBe('anonimo:inicial')

    expect(await entrar(BRUNO)).toEqual({ ok: true })

    expect(estadoVisivel()).toBe('autenticado:bruno:COLABORADOR_INDIVIDUAL')
    expect(servidor.da('POST /api/login')).toHaveLength(1)
  })

  it('sob StrictMode, a query da sessão roda e o logout limpa tudo', async () => {
    servidor.interceptar('GET /api/cursos', () => json([]))
    const { queryClient } = await abrir({ strict: true, comCursos: true })
    await entrar(ANA)
    await esvaziar()
    expect(screen.getByTestId('cursos').textContent).toBe('success')

    await sair()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('desmontar encerra a sessão local e aborta as requisições, sem fazer logout', async () => {
    servidor.interceptar('GET /api/cursos', () => new Promise<Response>(() => {}))
    const { unmount, queryClient } = await abrir({ comCursos: true })
    await entrar(ANA)
    await esvaziar()
    const { api } = sessaoAtual()
    const sinalCursos = servidor.da('GET /api/cursos')[0]?.sinal

    unmount()

    expect(api.encerrada).toBe(true)
    expect(sinalCursos?.aborted).toBe(true)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(servidor.atual?.usuario).toBe('ana')
    expect(localStorage.length).toBe(0)
  })

  it('login pendente durante a desmontagem resolve como cancelado', async () => {
    const { unmount } = await abrir()
    const login1 = segurarLogin()
    const login = iniciarLogin(ANA)
    await esperarLogins(1)
    unmount()
    login1.liberar()
    expect(await login).toEqual({ ok: false, motivo: 'cancelado' })
  })
})

describe('privacidade', () => {
  it('não persiste, não registra e não expõe credenciais', async () => {
    const armazenamento = [vi.spyOn(Storage.prototype, 'setItem'), vi.spyOn(Storage.prototype, 'getItem')]
    const consoles = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m))
    await abrir()

    await entrar(ANA)
    await sair()
    await entrar(ANA)

    for (const espiao of consoles) {
      expect(espiao).not.toHaveBeenCalled()
    }
    // A única chave que a autenticação toca é o marcador, e só com "true" ou o teste de gravação.
    const [gravacoes, leituras] = armazenamento
    expect(new Set(gravacoes!.mock.calls.map(([chave]) => chave))).toEqual(new Set([CHAVE_SAIDA_PENDENTE]))
    expect(gravacoes!.mock.calls.every(([, valor]) => valor === 'true' || valor === 'false')).toBe(true)
    expect(new Set(leituras!.mock.calls.map(([chave]) => chave))).toEqual(new Set([CHAVE_SAIDA_PENDENTE]))
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    expect(document.body.textContent).not.toContain(ANA.senha)
    const { identidade, tipoConta, geracao } = sessaoAtual()
    const estadoSemApi = { identidade, tipoConta, geracao }
    expect(JSON.stringify(estadoSemApi)).not.toContain(ANA.senha)
    expect(JSON.stringify(estadoSemApi)).not.toContain(servidor.atual!.contexto)
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
