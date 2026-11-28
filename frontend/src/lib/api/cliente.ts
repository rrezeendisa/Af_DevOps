import { z } from 'zod'
import { codificarBasic, type Credenciais } from './credenciais'
import { ApiError, ehApiError, extrairCodigo, tipoDeMidia } from './erros'

/** Prazos por requisição HTTP, incluindo a leitura do corpo. Ver API_CONTRACTS.md, seção 8. */
export const TEMPOS_LIMITE_MS = {
  padrao: 15_000,
  ia: 20_000,
  /** Orientação: FastAPI (~7 s) + geração complementar (até 60 s) + margem. */
  orientacao: 90_000,
} as const

const TEMPO_LIMITE_MAXIMO_MS = 120_000

export type Validador<T> = (dados: unknown) => T

export type OpcoesRequisicao = {
  /** Cancelamento por quem chama (por exemplo, ao sair da tela). */
  signal?: AbortSignal
  /** Prazo em milissegundos, inteiro de 1 a 120000. Padrão: `TEMPOS_LIMITE_MS.padrao`. */
  tempoLimiteMs?: number
}

export type MetodoEscrita = 'POST' | 'PUT'

export type OpcoesSessao = {
  /**
   * Chamado no máximo uma vez quando uma resposta da sessão tem status 401 e ela ainda não foi
   * encerrada. Status 403 não chama. A requisição que recebeu o 401 continua rejeitando com esse erro.
   */
  aoNaoAutenticado?: () => void
}

export interface SessaoApi {
  /** GET com resposta JSON obrigatória. */
  obter<T>(caminho: string, validar: Validador<T>, opcoes?: OpcoesRequisicao): Promise<T>
  /** POST com CSRF e resposta JSON obrigatória. `corpo` `undefined` envia a requisição sem corpo. */
  enviar<T>(caminho: string, corpo: unknown, validar: Validador<T>, opcoes?: OpcoesRequisicao): Promise<T>
  /** PUT com CSRF e resposta JSON obrigatória. */
  substituir<T>(caminho: string, corpo: unknown, validar: Validador<T>, opcoes?: OpcoesRequisicao): Promise<T>
  /** Escrita com CSRF cuja resposta de sucesso pode não ter corpo. O corpo recebido é ignorado. */
  escreverSemResposta(metodo: MetodoEscrita, caminho: string, corpo: unknown, opcoes?: OpcoesRequisicao): Promise<void>
  /** Cancela tudo o que está pendente, descarta as credenciais e impede novas chamadas. */
  encerrar(): void
  readonly encerrada: boolean
}

type RespostaLida = { status: number; tipoConteudo: string | null; texto: string }

const TEMPO_ESGOTADO = Symbol('tempo-limite')
const CANCELADO = Symbol('cancelado')

const ACCEPT = 'application/json, application/problem+json'
const CABECALHO_CSRF = 'X-XSRF-TOKEN'
const esquemaCsrf = z.object({
  headerName: z.literal(CABECALHO_CSRF),
  token: z.string().regex(/^[A-Za-z0-9_-]+$/),
})

/** Só segmentos simples sob /api: sem '.', '%', '\', '?', '#', '//' nem barra final. */
const PADRAO_CAMINHO = /^\/api(?:\/[A-Za-z0-9_-]+)+$/

function validarCaminho(caminho: string): string {
  const invalido = new TypeError('Caminho de API inválido.')
  if (typeof caminho !== 'string' || !PADRAO_CAMINHO.test(caminho)) {
    throw invalido
  }
  // Segunda barreira: o caminho normalizado pela API URL precisa continuar idêntico e na mesma origem.
  const origem = window.location.origin
  const url = new URL(caminho, origem)
  if (url.origin !== origem || url.pathname !== caminho || url.search !== '' || url.hash !== '') {
    throw invalido
  }
  return url.pathname
}

function validarTempoLimite(tempoLimiteMs: number | undefined): number {
  const valor = tempoLimiteMs ?? TEMPOS_LIMITE_MS.padrao
  if (!Number.isInteger(valor) || valor < 1 || valor > TEMPO_LIMITE_MAXIMO_MS) {
    throw new RangeError(`tempoLimiteMs deve ser um inteiro de 1 a ${TEMPO_LIMITE_MAXIMO_MS}.`)
  }
  return valor
}

function erroDeAborto(sinal: AbortSignal): ApiError {
  return new ApiError(sinal.reason === TEMPO_ESGOTADO ? 'tempo-limite' : 'cancelado')
}

type Escopo = { readonly sinal: AbortSignal; liberar(): void }

/**
 * Sinal que aborta quando qualquer fonte aborta ou quando o prazo acaba. O primeiro motivo
 * prevalece, porque novas chamadas a `abort` são ignoradas. `liberar` remove timer e listeners.
 */
function criarEscopo(fontes: readonly AbortSignal[], tempoLimiteMs?: number): Escopo {
  const controle = new AbortController()
  const cancelar = () => controle.abort(CANCELADO)
  for (const fonte of fontes) {
    if (fonte.aborted) {
      cancelar()
    } else {
      fonte.addEventListener('abort', cancelar, { once: true })
    }
  }
  const timer =
    tempoLimiteMs === undefined || controle.signal.aborted
      ? undefined
      : setTimeout(() => controle.abort(TEMPO_ESGOTADO), tempoLimiteMs)
  return {
    sinal: controle.signal,
    liberar() {
      clearTimeout(timer)
      for (const fonte of fontes) {
        fonte.removeEventListener('abort', cancelar)
      }
    },
  }
}

/** Espera a promessa, mas rejeita imediatamente se o sinal abortar. */
function aguardar<T>(promessa: Promise<T>, sinal: AbortSignal): Promise<T> {
  if (sinal.aborted) {
    return Promise.reject(erroDeAborto(sinal))
  }
  return new Promise<T>((resolver, rejeitar) => {
    const aoAbortar = () => rejeitar(erroDeAborto(sinal))
    sinal.addEventListener('abort', aoAbortar, { once: true })
    promessa.then(
      (valor) => {
        sinal.removeEventListener('abort', aoAbortar)
        resolver(valor)
      },
      (erro: unknown) => {
        sinal.removeEventListener('abort', aoAbortar)
        rejeitar(erro)
      },
    )
  })
}

function exigirSucesso(resposta: RespostaLida): void {
  if (resposta.status < 200 || resposta.status > 299) {
    throw new ApiError('http', {
      status: resposta.status,
      codigo: extrairCodigo(resposta.status, resposta.tipoConteudo, resposta.texto),
    })
  }
}

function lerJson<T>(resposta: RespostaLida, validar: Validador<T>): T {
  exigirSucesso(resposta)
  if (resposta.texto === '' || tipoDeMidia(resposta.tipoConteudo) !== 'application/json') {
    throw new ApiError('resposta-invalida', { status: resposta.status })
  }
  let dados: unknown
  try {
    dados = JSON.parse(resposta.texto)
  } catch {
    throw new ApiError('resposta-invalida', { status: resposta.status })
  }
  try {
    return validar(dados)
  } catch {
    // O erro original do validador pode citar valores recebidos e não é anexado.
    throw new ApiError('resposta-invalida', { status: resposta.status })
  }
}

/**
 * Cria a sessão de API de um usuário. As credenciais ficam somente no closure desta sessão.
 * Na troca de usuário, encerre a sessão anterior e crie outra.
 */
export function criarSessaoApi(credenciais: Credenciais, opcoesSessao: OpcoesSessao = {}): SessaoApi {
  let autorizacao: string | null = codificarBasic(credenciais)
  const controleSessao = new AbortController()
  let caudaEscrita: Promise<void> = Promise.resolve()
  let naoAutenticadoNotificado = false

  /** Avisa no máximo uma vez por sessão, e nunca depois de `encerrar()`. */
  function notificarNaoAutenticado(): void {
    if (naoAutenticadoNotificado || autorizacao === null) {
      return
    }
    naoAutenticadoNotificado = true
    try {
      opcoesSessao.aoNaoAutenticado?.()
    } catch {
      // Uma falha no callback não pode alterar o resultado da requisição.
    }
  }

  function fontes(opcoes: OpcoesRequisicao | undefined): AbortSignal[] {
    return opcoes?.signal ? [controleSessao.signal, opcoes.signal] : [controleSessao.signal]
  }

  async function requisitar(
    metodo: 'GET' | MetodoEscrita,
    caminho: string,
    corpo: unknown,
    origens: readonly AbortSignal[],
    tempoLimiteMs: number,
    tokenCsrf?: string,
  ): Promise<RespostaLida> {
    const escopo = criarEscopo(origens, tempoLimiteMs)
    try {
      if (escopo.sinal.aborted || autorizacao === null) {
        throw escopo.sinal.aborted ? erroDeAborto(escopo.sinal) : new ApiError('cancelado')
      }
      const cabecalhos = new Headers({ Accept: ACCEPT, Authorization: autorizacao })
      const init: RequestInit = {
        method: metodo,
        headers: cabecalhos,
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        signal: escopo.sinal,
      }
      if (corpo !== undefined) {
        cabecalhos.set('Content-Type', 'application/json')
        init.body = JSON.stringify(corpo)
      }
      if (tokenCsrf !== undefined) {
        cabecalhos.set(CABECALHO_CSRF, tokenCsrf)
      }

      let resposta: Response
      try {
        resposta = await aguardar(fetch(caminho, init), escopo.sinal)
      } catch (erro) {
        throw ehApiError(erro) ? erro : new ApiError('rede')
      }

      // O prazo também cobre a leitura completa do corpo.
      let texto: string
      try {
        texto = await aguardar(resposta.text(), escopo.sinal)
      } catch (erro) {
        throw ehApiError(erro) ? erro : new ApiError('rede', { status: resposta.status })
      }
      if (resposta.status === 401) {
        notificarNaoAutenticado()
      }
      // Mesmo que o callback encerre a sessão, esta resposta segue adiante e rejeita com o 401 original.
      return { status: resposta.status, tipoConteudo: resposta.headers.get('Content-Type'), texto }
    } finally {
      escopo.liberar()
    }
  }

  /**
   * Executa as tarefas de escrita uma de cada vez, na ordem de chegada. Uma tarefa cancelada
   * enquanto espera rejeita na hora e não executa. A próxima continua esperando a anterior.
   */
  function naFila<T>(sinal: AbortSignal, tarefa: () => Promise<T>): Promise<T> {
    const anterior = caudaEscrita
    let liberarVaga: () => void = () => {}
    caudaEscrita = new Promise<void>((resolver) => {
      liberarVaga = resolver
    })
    const execucao = (async () => {
      await aguardar(anterior, sinal)
      return tarefa()
    })()
    // A vaga só é liberada depois da anterior e do fim desta. Assim a ordem se mantém mesmo com cancelamento.
    void execucao.then(
      () => anterior.then(liberarVaga),
      () => anterior.then(liberarVaga),
    )
    return execucao
  }

  async function escrever<T>(
    metodo: MetodoEscrita,
    caminho: string,
    corpo: unknown,
    opcoes: OpcoesRequisicao | undefined,
    interpretar: (resposta: RespostaLida) => T,
  ): Promise<T> {
    const caminhoValido = validarCaminho(caminho)
    const tempoLimite = validarTempoLimite(opcoes?.tempoLimiteMs)
    if (autorizacao === null) {
      throw new ApiError('cancelado')
    }
    const operacao = criarEscopo(fontes(opcoes))
    try {
      return await naFila(operacao.sinal, async () => {
        const respostaCsrf = await requisitar('GET', '/api/csrf', undefined, [operacao.sinal], TEMPOS_LIMITE_MS.padrao)
        const { token } = lerJson(respostaCsrf, (dados) => esquemaCsrf.parse(dados))
        // Sem retentativa automática: qualquer falha volta para quem chamou.
        const resposta = await requisitar(metodo, caminhoValido, corpo, [operacao.sinal], tempoLimite, token)
        return interpretar(resposta)
      })
    } finally {
      operacao.liberar()
    }
  }

  return {
    async obter<T>(caminho: string, validar: Validador<T>, opcoes?: OpcoesRequisicao): Promise<T> {
      const caminhoValido = validarCaminho(caminho)
      const tempoLimite = validarTempoLimite(opcoes?.tempoLimiteMs)
      const resposta = await requisitar('GET', caminhoValido, undefined, fontes(opcoes), tempoLimite)
      return lerJson(resposta, validar)
    },
    enviar<T>(caminho: string, corpo: unknown, validar: Validador<T>, opcoes?: OpcoesRequisicao): Promise<T> {
      return escrever('POST', caminho, corpo, opcoes, (resposta) => lerJson(resposta, validar))
    },
    substituir<T>(caminho: string, corpo: unknown, validar: Validador<T>, opcoes?: OpcoesRequisicao): Promise<T> {
      return escrever('PUT', caminho, corpo, opcoes, (resposta) => lerJson(resposta, validar))
    },
    escreverSemResposta(metodo: MetodoEscrita, caminho: string, corpo: unknown, opcoes?: OpcoesRequisicao): Promise<void> {
      return escrever(metodo, caminho, corpo, opcoes, exigirSucesso)
    },
    encerrar(): void {
      autorizacao = null
      controleSessao.abort(CANCELADO)
    },
    get encerrada(): boolean {
      return autorizacao === null
    },
  }
}
