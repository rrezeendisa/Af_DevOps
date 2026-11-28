import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarSessaoApi, TEMPOS_LIMITE_MS, type SessaoApi } from './cliente'
import { ApiError } from './erros'

// Respostas simuladas existem somente nestes testes.

const CREDENCIAIS = { nomeUsuario: 'ana', senha: 'senha-secreta-çã€1' }
const BASIC_ANA = 'Basic YW5hOnNlbmhhLXNlY3JldGEtw6fDo+KCrDE='
const TOKEN = 'tokenCsrfMascarado_123-abc'

type Chamada = { url: string; metodo: string; cabecalhos: Headers; corpo: unknown }

const fetchMock = vi.fn<typeof fetch>()

function json(dados: unknown, status = 200, tipo = 'application/json'): Response {
  return new Response(JSON.stringify(dados), { status, headers: { 'Content-Type': tipo } })
}

function problema(status: number, dados: Record<string, unknown>): Response {
  return json({ status, ...dados }, status, 'application/problem+json')
}

function csrf(token = TOKEN, headerName = 'X-XSRF-TOKEN'): Response {
  return json({ headerName, token })
}

/** Resposta cujo corpo nunca termina de chegar. */
function corpoInfinito(): Response {
  const corpo = new ReadableStream<Uint8Array>({
    start(controle) {
      controle.enqueue(new TextEncoder().encode('{"parcial":'))
    },
  })
  return new Response(corpo, { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function adiado<T>() {
  let resolver: (valor: T) => void = () => {}
  const promessa = new Promise<T>((r) => {
    resolver = r
  })
  return { promessa, resolver }
}

const nunca = () => new Promise<Response>(() => {})

function chamadas(): Chamada[] {
  return fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    metodo: init?.method ?? 'GET',
    cabecalhos: new Headers(init?.headers),
    corpo: init?.body,
  }))
}

function chamada(indice: number): Chamada {
  const encontrada = chamadas()[indice]
  if (!encontrada) {
    throw new Error(`Chamada ${indice} não registrada.`)
  }
  return encontrada
}

const rotas = () => chamadas().map((c) => `${c.metodo} ${c.url}`)

/** Captura a rejeição esperada sem deixar promessas pendentes sem tratamento. */
async function falha(promessa: Promise<unknown>): Promise<unknown> {
  try {
    await promessa
  } catch (erro) {
    return erro
  }
  throw new Error('A promessa deveria ter sido rejeitada.')
}

function estado(promessa: Promise<unknown>) {
  const atual = { liquidada: false }
  promessa.then(
    () => (atual.liquidada = true),
    () => (atual.liquidada = true),
  )
  return atual
}

async function esperarChamadas(quantidade: number): Promise<void> {
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(quantidade))
}

const aceitarQualquer = (dados: unknown) => dados
const esperarApiError = (erro: unknown, campos: Partial<ApiError>) => {
  expect(erro).toBeInstanceOf(ApiError)
  expect(erro).toMatchObject(campos)
}

let sessao: SessaoApi

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  sessao = criarSessaoApi(CREDENCIAIS)
})

afterEach(() => {
  sessao.encerrar()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('leituras', () => {
  it('envia GET relativo com Basic UTF-8 e opções seguras', async () => {
    fetchMock.mockResolvedValueOnce(json({ nomeUsuario: 'ana', perfil: 'COLABORADOR', colaboradorId: 7 }))

    await expect(sessao.obter('/api/me', aceitarQualquer)).resolves.toEqual({
      nomeUsuario: 'ana',
      perfil: 'COLABORADOR',
      colaboradorId: 7,
    })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('/api/me')
    expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error' })
    expect(init?.body).toBeUndefined()
    const cabecalhos = new Headers(init?.headers)
    expect(cabecalhos.get('Authorization')).toBe(BASIC_ANA)
    expect(cabecalhos.get('Accept')).toBe('application/json, application/problem+json')
    expect(cabecalhos.has('Content-Type')).toBe(false)
    expect(cabecalhos.has('X-XSRF-TOKEN')).toBe(false)
  })

  it('aplica o validador e devolve o tipo dele', async () => {
    fetchMock.mockResolvedValueOnce(json([{ id: 1 }]))
    const lista = await sessao.obter('/api/cursos', (dados) => {
      if (!Array.isArray(dados)) throw new Error('não é lista')
      return dados.length
    })
    expect(lista).toBe(1)
  })

  it('não entra na fila de escrita', async () => {
    const csrfPendente = adiado<Response>()
    fetchMock.mockImplementation((url) =>
      url === '/api/csrf' ? csrfPendente.promessa : Promise.resolve(json([])),
    )

    const escrita = sessao.enviar('/api/cursos', { nome: 'x' }, aceitarQualquer)
    await esperarChamadas(1)
    await expect(sessao.obter('/api/cursos', aceitarQualquer)).resolves.toEqual([])

    sessao.encerrar()
    await falha(escrita)
  })
})

describe('validação de caminhos', () => {
  it.each([
    'http://outra.origem/api/me',
    'https://localhost/api/me',
    '//outra.origem/api/me',
    'api/me',
    ' /api/me',
    '/api',
    '/api/',
    '/api//me',
    '/api/me/',
    '/API/me',
    '/actuator/health',
    '/internal/treinamentos/1/status',
    '/api/../internal/treinamentos/1/status',
    '/api/./me',
    '/api/%2e%2e/internal/treinamentos/1/status',
    '/api/%2E%2E%2Finternal',
    '/api/me%2F..%2F..%2Finternal',
    '/api/me%5C..',
    '/api\\me',
    '/api/me\\..\\..\\internal',
    '/api/me#fragmento',
    '/api/me?x=1',
    '/api/me\n',
  ])('rejeita %j sem chamar fetch', async (caminho) => {
    expect(await falha(sessao.obter(caminho, aceitarQualquer))).toBeInstanceOf(TypeError)
    expect(await falha(sessao.enviar(caminho, {}, aceitarQualquer))).toBeInstanceOf(TypeError)
    expect(await falha(sessao.escreverSemResposta('PUT', caminho, {}))).toBeInstanceOf(TypeError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('aceita rotas reais com identificadores', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({})))
    await sessao.obter('/api/colaboradores/12', aceitarQualquer)
    await sessao.obter('/api/me/consentimento', aceitarQualquer)
    expect(rotas()).toEqual(['GET /api/colaboradores/12', 'GET /api/me/consentimento'])
  })
})

describe('interpretação de respostas', () => {
  it('devolve os dados de um 202 com JSON', async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(json({ id: 3, status: 'PENDENTE' }, 202))
    await expect(sessao.enviar('/api/treinamentos', undefined, aceitarQualquer)).resolves.toEqual({
      id: 3,
      status: 'PENDENTE',
    })
  })

  it.each([
    ['204 sem corpo', () => new Response(null, { status: 204 })],
    ['200 com corpo vazio', () => new Response('', { status: 200, headers: { 'Content-Type': 'application/json' } })],
  ])('trata %s com validador obrigatório como resposta inválida', async (_caso, resposta) => {
    fetchMock.mockResolvedValueOnce(resposta())
    esperarApiError(await falha(sessao.obter('/api/me', aceitarQualquer)), { tipo: 'resposta-invalida' })
  })

  it('aceita resposta sem corpo quando a operação admite', async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(sessao.escreverSemResposta('PUT', '/api/me/consentimento', { autorizado: true })).resolves.toBeUndefined()
  })

  it.each([
    ['JSON malformado', () => new Response('{"a":', { headers: { 'Content-Type': 'application/json' } })],
    ['HTML', () => new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } })],
    ['sem Content-Type', () => new Response('{"a":1}')],
  ])('rejeita %s como resposta inválida', async (_caso, resposta) => {
    fetchMock.mockResolvedValueOnce(resposta())
    esperarApiError(await falha(sessao.obter('/api/me', aceitarQualquer)), { tipo: 'resposta-invalida' })
  })

  it('não anexa o erro original do validador', async () => {
    fetchMock.mockResolvedValueOnce(json({ email: 'pessoa@example.com' }))
    const erro = await falha(
      sessao.obter('/api/me', (dados) => {
        throw new Error(`valor recebido: ${JSON.stringify(dados)}`)
      }),
    )
    esperarApiError(erro, { tipo: 'resposta-invalida', status: 200 })
    expect((erro as Error).cause).toBeUndefined()
    expect(String(erro) + JSON.stringify(erro)).not.toContain('pessoa@example.com')
  })

  it('converte problem+json em ApiError com status e código', async () => {
    fetchMock.mockResolvedValueOnce(problema(404, { codigo: 'CURSO_NAO_ENCONTRADO' }))
    esperarApiError(await falha(sessao.obter('/api/cursos/9', aceitarQualquer)), {
      tipo: 'http',
      status: 404,
      codigo: 'CURSO_NAO_ENCONTRADO',
    })
  })

  it('aceita erro sem corpo, mantendo apenas o status', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }))
    esperarApiError(await falha(sessao.obter('/api/cursos', aceitarQualquer)), {
      tipo: 'http',
      status: 503,
      codigo: undefined,
    })
  })

  it('descarta title, detail e campos extras com dados sensíveis', async () => {
    fetchMock.mockResolvedValueOnce(
      problema(409, {
        codigo: 'EMAIL_DUPLICADO',
        title: 'Token interno abc123',
        detail: 'senha=hunter2 email=pessoa@example.com',
        instance: '/api/colaboradores?segredo=1',
        cabecalhos: { Authorization: 'Basic c2VncmVkbw==' },
      }),
    )
    const erro = await falha(sessao.obter('/api/colaboradores', aceitarQualquer))
    esperarApiError(erro, { tipo: 'http', status: 409, codigo: 'EMAIL_DUPLICADO' })
    const exposto = `${String(erro)} ${JSON.stringify(erro)} ${Object.values(erro as object).join(' ')}`
    for (const segredo of ['abc123', 'hunter2', 'pessoa@example.com', 'segredo', 'c2VncmVkbw']) {
      expect(exposto).not.toContain(segredo)
    }
    expect(Object.keys(JSON.parse(JSON.stringify(erro)))).toEqual(['name', 'tipo', 'status', 'codigo'])
  })

  it('descarta código desconhecido', async () => {
    fetchMock.mockResolvedValueOnce(problema(500, { codigo: 'STACK_TRACE_INTERNO' }))
    esperarApiError(await falha(sessao.obter('/api/cursos', aceitarQualquer)), { status: 500, codigo: undefined })
  })

  it('converte falha de rede em ApiError', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    esperarApiError(await falha(sessao.obter('/api/cursos', aceitarQualquer)), { tipo: 'rede' })
  })
})

describe('tempo limite', () => {
  it('usa 15 s por padrão', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(nunca)
    const pedido = sessao.obter('/api/cursos', aceitarQualquer)
    const situacao = estado(pedido)
    await vi.advanceTimersByTimeAsync(TEMPOS_LIMITE_MS.padrao - 1)
    expect(situacao.liquidada).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    esperarApiError(await falha(pedido), { tipo: 'tempo-limite' })
  })

  it('aguarda até 90 s na orientação', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((url) => (url === '/api/csrf' ? Promise.resolve(csrf()) : nunca()))
    const pedido = sessao.enviar('/api/ia/orientacoes', { pergunta: 'Por onde começo?' }, aceitarQualquer, {
      tempoLimiteMs: TEMPOS_LIMITE_MS.orientacao,
    })
    const situacao = estado(pedido)
    await vi.advanceTimersByTimeAsync(89_999)
    expect(situacao.liquidada).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    esperarApiError(await falha(pedido), { tipo: 'tempo-limite' })
  })

  it('inclui a leitura completa do corpo no prazo', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(() => Promise.resolve(corpoInfinito()))
    const erro = falha(sessao.obter('/api/cursos', aceitarQualquer, { tempoLimiteMs: 1_000 }))
    await vi.advanceTimersByTimeAsync(1_000)
    esperarApiError(await erro, { tipo: 'tempo-limite' })
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 120_001])(
    'rejeita tempoLimiteMs inválido (%s) sem chamar fetch',
    async (tempoLimiteMs) => {
      expect(await falha(sessao.obter('/api/cursos', aceitarQualquer, { tempoLimiteMs }))).toBeInstanceOf(RangeError)
      expect(await falha(sessao.enviar('/api/cursos', {}, aceitarQualquer, { tempoLimiteMs }))).toBeInstanceOf(
        RangeError,
      )
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('limpa timers e listeners ao terminar', async () => {
    vi.useFakeTimers()
    const externo = new AbortController()
    const adicionar = vi.spyOn(externo.signal, 'addEventListener')
    const remover = vi.spyOn(externo.signal, 'removeEventListener')
    fetchMock.mockResolvedValueOnce(json({})).mockResolvedValueOnce(csrf()).mockResolvedValueOnce(json({}))

    await sessao.obter('/api/me', aceitarQualquer, { signal: externo.signal })
    await sessao.enviar('/api/cursos', {}, aceitarQualquer, { signal: externo.signal })

    expect(vi.getTimerCount()).toBe(0)
    expect(adicionar).toHaveBeenCalled()
    expect(remover).toHaveBeenCalledTimes(adicionar.mock.calls.length)
  })

  it('mantém o tempo limite quando o encerramento chega depois', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(nunca)
    const pedido = sessao.obter('/api/cursos', aceitarQualquer, { tempoLimiteMs: 1_000 })
    const erro = falha(pedido)
    await vi.advanceTimersByTimeAsync(1_000)
    sessao.encerrar()
    esperarApiError(await erro, { tipo: 'tempo-limite' })
  })

  it('mantém o cancelamento quando o tempo limite chega depois', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(nunca)
    const pedido = sessao.obter('/api/cursos', aceitarQualquer, { tempoLimiteMs: 1_000 })
    const erro = falha(pedido)
    await vi.advanceTimersByTimeAsync(500)
    sessao.encerrar()
    await vi.advanceTimersByTimeAsync(1_000)
    esperarApiError(await erro, { tipo: 'cancelado' })
  })
})

describe('cancelamento e encerramento', () => {
  it('cancela pelo sinal externo', async () => {
    fetchMock.mockImplementation(nunca)
    const externo = new AbortController()
    const pedido = sessao.obter('/api/cursos', aceitarQualquer, { signal: externo.signal })
    await esperarChamadas(1)
    externo.abort()
    esperarApiError(await falha(pedido), { tipo: 'cancelado' })
  })

  it('não chama fetch com sinal já abortado', async () => {
    const externo = new AbortController()
    externo.abort()
    esperarApiError(await falha(sessao.obter('/api/cursos', aceitarQualquer, { signal: externo.signal })), {
      tipo: 'cancelado',
    })
    esperarApiError(await falha(sessao.enviar('/api/cursos', {}, aceitarQualquer, { signal: externo.signal })), {
      tipo: 'cancelado',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('encerrar aborta a requisição em andamento e impede novas chamadas', async () => {
    fetchMock.mockImplementation(nunca)
    const pedido = sessao.obter('/api/cursos', aceitarQualquer)
    await esperarChamadas(1)

    sessao.encerrar()

    esperarApiError(await falha(pedido), { tipo: 'cancelado' })
    expect(sessao.encerrada).toBe(true)
    esperarApiError(await falha(sessao.obter('/api/me', aceitarQualquer)), { tipo: 'cancelado' })
    esperarApiError(await falha(sessao.enviar('/api/cursos', {}, aceitarQualquer)), { tipo: 'cancelado' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('cancela durante a leitura do corpo', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(corpoInfinito()))
    const externo = new AbortController()
    const pedido = sessao.obter('/api/cursos', aceitarQualquer, { signal: externo.signal })
    await esperarChamadas(1)
    externo.abort()
    esperarApiError(await falha(pedido), { tipo: 'cancelado' })
  })

  it('encerra durante a leitura do corpo', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(corpoInfinito()))
    const pedido = sessao.obter('/api/cursos', aceitarQualquer)
    await esperarChamadas(1)
    sessao.encerrar()
    esperarApiError(await falha(pedido), { tipo: 'cancelado' })
  })

  it('encerra durante a obtenção do CSRF sem enviar a escrita', async () => {
    fetchMock.mockImplementation(nunca)
    const escrita = sessao.enviar('/api/cursos', { nome: 'x' }, aceitarQualquer)
    await esperarChamadas(1)
    sessao.encerrar()
    esperarApiError(await falha(escrita), { tipo: 'cancelado' })
    expect(rotas()).toEqual(['GET /api/csrf'])
  })

  it('encerra durante a leitura do corpo do CSRF sem enviar a escrita', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(corpoInfinito()))
    const escrita = sessao.enviar('/api/cursos', { nome: 'x' }, aceitarQualquer)
    await esperarChamadas(1)
    sessao.encerrar()
    esperarApiError(await falha(escrita), { tipo: 'cancelado' })
    expect(rotas()).toEqual(['GET /api/csrf'])
  })

  it('encerra com várias operações na fila: todas rejeitam e nada mais é enviado', async () => {
    fetchMock.mockImplementation(nunca)
    const escritas = [
      sessao.enviar('/api/cursos', { n: 1 }, aceitarQualquer),
      sessao.enviar('/api/cursos', { n: 2 }, aceitarQualquer),
      sessao.substituir('/api/me/consentimento', { autorizado: true }, aceitarQualquer),
      sessao.escreverSemResposta('POST', '/api/treinamentos', undefined),
    ]
    await esperarChamadas(1)

    sessao.encerrar()

    for (const escrita of escritas) {
      esperarApiError(await falha(escrita), { tipo: 'cancelado' })
    }
    await new Promise((r) => setTimeout(r, 0))
    expect(rotas()).toEqual(['GET /api/csrf'])
  })
})

describe('escritas com CSRF', () => {
  it('obtém o CSRF e envia a escrita com o token do JSON', async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(json({ id: 1 }, 201))

    await expect(sessao.enviar('/api/cursos', { nome: 'Lógica', cargaHoraria: 8 }, aceitarQualquer)).resolves.toEqual({
      id: 1,
    })

    expect(rotas()).toEqual(['GET /api/csrf', 'POST /api/cursos'])
    expect(chamada(0).cabecalhos.get('Authorization')).toBe(BASIC_ANA)
    expect(chamada(0).cabecalhos.has('X-XSRF-TOKEN')).toBe(false)
    const escrita = chamada(1)
    expect(escrita.cabecalhos.get('Authorization')).toBe(BASIC_ANA)
    expect(escrita.cabecalhos.get('X-XSRF-TOKEN')).toBe(TOKEN)
    expect(escrita.cabecalhos.get('Content-Type')).toBe('application/json')
    expect(escrita.corpo).toBe('{"nome":"Lógica","cargaHoraria":8}')
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store' })
  })

  it('envia PUT com CSRF', async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(json({ autorizado: true, decididoEm: 'x' }))
    await sessao.substituir('/api/me/consentimento', { autorizado: true }, aceitarQualquer)
    expect(rotas()).toEqual(['GET /api/csrf', 'PUT /api/me/consentimento'])
    expect(chamada(1).corpo).toBe('{"autorizado":true}')
  })

  it('envia POST sem corpo e sem Content-Type', async () => {
    fetchMock.mockResolvedValueOnce(csrf()).mockResolvedValueOnce(json({ id: 1 }, 202))
    await sessao.enviar('/api/treinamentos', undefined, aceitarQualquer)
    expect(chamada(1).corpo).toBeUndefined()
    expect(chamada(1).cabecalhos.has('Content-Type')).toBe(false)
  })

  it.each([
    ['headerName inesperado', () => csrf(TOKEN, 'X-CSRF-TOKEN'), 'resposta-invalida'],
    ['token com caractere proibido', () => csrf('abc;def'), 'resposta-invalida'],
    ['token vazio', () => csrf(''), 'resposta-invalida'],
    ['JSON inválido', () => new Response('{', { headers: { 'Content-Type': 'application/json' } }), 'resposta-invalida'],
    ['401', () => problema(401, { codigo: 'AUTENTICACAO_NECESSARIA' }), 'http'],
  ] as const)('não envia a escrita com CSRF inválido: %s', async (_caso, resposta, tipo) => {
    fetchMock.mockResolvedValueOnce(resposta())
    esperarApiError(await falha(sessao.enviar('/api/cursos', {}, aceitarQualquer)), { tipo })
    expect(rotas()).toEqual(['GET /api/csrf'])
  })

  it('serializa escritas concorrentes: csrf₁ → escrita₁ → csrf₂ → escrita₂', async () => {
    const primeira = adiado<Response>()
    fetchMock
      .mockResolvedValueOnce(csrf('token1'))
      .mockReturnValueOnce(primeira.promessa)
      .mockResolvedValueOnce(csrf('token2'))
      .mockResolvedValueOnce(json({ n: 2 }, 201))

    const escrita1 = sessao.enviar('/api/cursos', { n: 1 }, aceitarQualquer)
    const escrita2 = sessao.enviar('/api/colaboradores', { n: 2 }, aceitarQualquer)
    await esperarChamadas(2)
    await new Promise((r) => setTimeout(r, 0))
    expect(rotas()).toEqual(['GET /api/csrf', 'POST /api/cursos'])

    primeira.resolver(json({ n: 1 }, 201))
    await expect(escrita1).resolves.toEqual({ n: 1 })
    await expect(escrita2).resolves.toEqual({ n: 2 })

    expect(rotas()).toEqual(['GET /api/csrf', 'POST /api/cursos', 'GET /api/csrf', 'POST /api/colaboradores'])
    expect(chamada(1).cabecalhos.get('X-XSRF-TOKEN')).toBe('token1')
    expect(chamada(3).cabecalhos.get('X-XSRF-TOKEN')).toBe('token2')
  })

  it('uma falha não bloqueia a próxima escrita', async () => {
    fetchMock
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(problema(409, { codigo: 'EMAIL_DUPLICADO' }))
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(json({ id: 2 }, 201))

    const escrita1 = sessao.enviar('/api/colaboradores', { email: 'a@b.c' }, aceitarQualquer)
    const escrita2 = sessao.enviar('/api/colaboradores', { email: 'd@e.f' }, aceitarQualquer)

    esperarApiError(await falha(escrita1), { codigo: 'EMAIL_DUPLICADO' })
    await expect(escrita2).resolves.toEqual({ id: 2 })
  })

  it.each([
    ['403 CSRF_INVALIDO', () => Promise.resolve(problema(403, { codigo: 'CSRF_INVALIDO' })), 'http'],
    ['503 FILA_INDISPONIVEL', () => Promise.resolve(problema(503, { codigo: 'FILA_INDISPONIVEL' })), 'http'],
    ['erro de rede', () => Promise.reject(new TypeError('Failed to fetch')), 'rede'],
  ] as const)('não repete a escrita após %s', async (_caso, resposta, tipo) => {
    fetchMock.mockResolvedValueOnce(csrf()).mockImplementationOnce(resposta)
    esperarApiError(await falha(sessao.enviar('/api/treinamentos', undefined, aceitarQualquer)), { tipo })
    await new Promise((r) => setTimeout(r, 0))
    expect(rotas()).toEqual(['GET /api/csrf', 'POST /api/treinamentos'])
  })

  it('cancelada na fila rejeita na hora, não envia nada e preserva a ordem das demais', async () => {
    const primeira = adiado<Response>()
    fetchMock
      .mockResolvedValueOnce(csrf('token1'))
      .mockReturnValueOnce(primeira.promessa)
      .mockResolvedValueOnce(csrf('token3'))
      .mockResolvedValueOnce(json({ n: 3 }, 201))

    const externo = new AbortController()
    const escrita1 = sessao.enviar('/api/cursos', { n: 1 }, aceitarQualquer)
    const escrita2 = sessao.enviar('/api/cursos', { n: 2 }, aceitarQualquer, { signal: externo.signal })
    const escrita3 = sessao.enviar('/api/colaboradores', { n: 3 }, aceitarQualquer)
    await esperarChamadas(2)

    externo.abort()
    esperarApiError(await falha(escrita2), { tipo: 'cancelado' })
    expect(rotas()).toEqual(['GET /api/csrf', 'POST /api/cursos'])

    primeira.resolver(json({ n: 1 }, 201))
    await expect(escrita1).resolves.toEqual({ n: 1 })
    await expect(escrita3).resolves.toEqual({ n: 3 })
    expect(rotas()).toEqual(['GET /api/csrf', 'POST /api/cursos', 'GET /api/csrf', 'POST /api/colaboradores'])
    expect(chamadas().filter((c) => c.corpo === '{"n":2}')).toHaveLength(0)
  })
})

describe('isolamento e privacidade', () => {
  it('isola duas sessões de usuários diferentes', async () => {
    const outra = criarSessaoApi({ nomeUsuario: 'bruno', senha: 'outra-senha-123' })
    const csrfAna = adiado<Response>()
    fetchMock.mockImplementation((_url, init) => {
      const autorizacao = new Headers(init?.headers).get('Authorization')
      if (autorizacao === BASIC_ANA) return csrfAna.promessa
      return Promise.resolve(String(_url) === '/api/csrf' ? csrf('tokenBruno') : json({ ok: true }, 201))
    })

    const escritaAna = sessao.enviar('/api/cursos', { n: 1 }, aceitarQualquer)
    await esperarChamadas(1)

    // A fila da Ana não bloqueia o Bruno.
    await expect(outra.enviar('/api/cursos', { n: 2 }, aceitarQualquer)).resolves.toEqual({ ok: true })

    // Encerrar a Ana não afeta o Bruno.
    sessao.encerrar()
    esperarApiError(await falha(escritaAna), { tipo: 'cancelado' })
    await expect(outra.obter('/api/me', aceitarQualquer)).resolves.toEqual({ ok: true })
    expect(outra.encerrada).toBe(false)

    const autorizacoes = new Set(chamadas().map((c) => c.cabecalhos.get('Authorization')))
    expect(autorizacoes).toEqual(new Set([BASIC_ANA, 'Basic YnJ1bm86b3V0cmEtc2VuaGEtMTIz']))
    outra.encerrar()
  })

  it('não persiste nem registra credenciais, tokens ou dados', async () => {
    const armazenamento = [
      vi.spyOn(Storage.prototype, 'setItem'),
      vi.spyOn(Storage.prototype, 'getItem'),
    ]
    const consoles = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m))
    fetchMock
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(problema(400, { codigo: 'DADOS_INVALIDOS', detail: CREDENCIAIS.senha }))

    await sessao.obter('/api/me', aceitarQualquer)
    const erro = await falha(sessao.enviar('/api/cursos', { senha: CREDENCIAIS.senha }, aceitarQualquer))

    for (const espiao of [...armazenamento, ...consoles]) {
      expect(espiao).not.toHaveBeenCalled()
    }
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    const exposto = `${String(erro)} ${JSON.stringify(erro)} ${(erro as Error).stack ?? ''}`
    for (const segredo of [CREDENCIAIS.senha, BASIC_ANA, TOKEN]) {
      expect(exposto).not.toContain(segredo)
    }
  })
})

describe('aoNaoAutenticado', () => {
  function sessaoComAviso() {
    const aviso = vi.fn()
    return { aviso, sessao: criarSessaoApi(CREDENCIAIS, { aoNaoAutenticado: aviso }) }
  }

  it('avisa em 401 de leitura e preserva o erro HTTP original', async () => {
    const { aviso, sessao: comAviso } = sessaoComAviso()
    fetchMock.mockResolvedValueOnce(problema(401, { codigo: 'AUTENTICACAO_NECESSARIA' }))
    esperarApiError(await falha(comAviso.obter('/api/cursos', aceitarQualquer)), {
      tipo: 'http',
      status: 401,
      codigo: 'AUTENTICACAO_NECESSARIA',
    })
    expect(aviso).toHaveBeenCalledTimes(1)
    comAviso.encerrar()
  })

  it('avisa em 401 no CSRF e não envia a escrita', async () => {
    const { aviso, sessao: comAviso } = sessaoComAviso()
    fetchMock.mockResolvedValueOnce(problema(401, { codigo: 'AUTENTICACAO_NECESSARIA' }))
    esperarApiError(await falha(comAviso.enviar('/api/cursos', {}, aceitarQualquer)), { status: 401 })
    expect(aviso).toHaveBeenCalledTimes(1)
    expect(rotas()).toEqual(['GET /api/csrf'])
    comAviso.encerrar()
  })

  it('avisa no máximo uma vez por sessão', async () => {
    const { aviso, sessao: comAviso } = sessaoComAviso()
    fetchMock.mockImplementation(() => Promise.resolve(problema(401, { codigo: 'AUTENTICACAO_NECESSARIA' })))
    await falha(comAviso.obter('/api/cursos', aceitarQualquer))
    await falha(comAviso.obter('/api/me', aceitarQualquer))
    await Promise.all([falha(comAviso.obter('/api/cursos', aceitarQualquer)), falha(comAviso.obter('/api/me', aceitarQualquer))])
    expect(aviso).toHaveBeenCalledTimes(1)
    comAviso.encerrar()
  })

  it('preserva o 401 mesmo quando o callback encerra a sessão', async () => {
    const aviso = vi.fn(() => comAviso.encerrar())
    const comAviso = criarSessaoApi(CREDENCIAIS, { aoNaoAutenticado: aviso })
    fetchMock.mockResolvedValueOnce(problema(401, { codigo: 'AUTENTICACAO_NECESSARIA' }))
    esperarApiError(await falha(comAviso.obter('/api/cursos', aceitarQualquer)), { tipo: 'http', status: 401 })
    expect(comAviso.encerrada).toBe(true)
  })

  it('não avisa em 403', async () => {
    const { aviso, sessao: comAviso } = sessaoComAviso()
    fetchMock
      .mockResolvedValueOnce(problema(403, { codigo: 'ACESSO_NEGADO' }))
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(problema(403, { codigo: 'CONSENTIMENTO_IA_NECESSARIO' }))
    await falha(comAviso.obter('/api/colaboradores', aceitarQualquer))
    await falha(comAviso.enviar('/api/ia/classificacoes', {}, aceitarQualquer))
    expect(aviso).not.toHaveBeenCalled()
    comAviso.encerrar()
  })

  it('não avisa depois de encerrar, nem com resposta 401 atrasada', async () => {
    const { aviso, sessao: comAviso } = sessaoComAviso()
    const atrasada = adiado<Response>()
    fetchMock.mockReturnValueOnce(atrasada.promessa)
    const pedido = falha(comAviso.obter('/api/cursos', aceitarQualquer))
    await esperarChamadas(1)
    comAviso.encerrar()
    atrasada.resolver(problema(401, { codigo: 'AUTENTICACAO_NECESSARIA' }))
    esperarApiError(await pedido, { tipo: 'cancelado' })
    expect(aviso).not.toHaveBeenCalled()
  })

  it('ignora falhas do próprio callback', async () => {
    const comAviso = criarSessaoApi(CREDENCIAIS, {
      aoNaoAutenticado: () => {
        throw new Error('falha no callback')
      },
    })
    fetchMock.mockResolvedValueOnce(problema(401, { codigo: 'AUTENTICACAO_NECESSARIA' }))
    esperarApiError(await falha(comAviso.obter('/api/cursos', aceitarQualquer)), { tipo: 'http', status: 401 })
    comAviso.encerrar()
  })
})
