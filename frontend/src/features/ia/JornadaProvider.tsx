import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { useAuth, useSessaoApi } from '@/features/auth/contexto'
import { chaveConsentimento, useConsentimento } from '@/features/consentimento/api'
import { ehApiError } from '@/lib/api/erros'
import { mensagemDeErro } from '@/lib/api/mensagens'
import { classificar, orientar, recomendar, type Classificacao, type Competencias, type Orientacao, type Recomendacoes } from './api'
import { JornadaContext, type AvisoJornada, type EstadoJornada, type OperacaoIa, type ValorJornada } from './contextoJornada'

const SEM_PENDENCIAS: Record<OperacaoIa, boolean> = { classificacao: false, recomendacoes: false, orientacao: false }

const INICIAL: EstadoJornada = {
  versao: 0,
  notas: {},
  classificacao: null,
  recomendacoes: null,
  orientacao: null,
  pendente: SEM_PENDENCIAS,
  falha: {},
  aviso: null,
}

type Acao =
  | { tipo: 'nota'; notas: EstadoJornada['notas']; versao: number }
  | { tipo: 'inicio'; operacao: OperacaoIa }
  | { tipo: 'classificado'; dados: Classificacao }
  | { tipo: 'recomendado'; dados: Recomendacoes; base: Classificacao }
  | { tipo: 'orientado'; pergunta: string; dados: Orientacao }
  | { tipo: 'falha'; operacao: OperacaoIa; mensagem: string }
  | { tipo: 'fim'; operacao: OperacaoIa; aviso?: AvisoJornada | undefined }
  | { tipo: 'descartar'; motivo: AvisoJornada; versao: number }
  | { tipo: 'limparAviso' }

function reduzir(estado: EstadoJornada, acao: Acao): EstadoJornada {
  switch (acao.tipo) {
    case 'nota':
      // Notas novas invalidam tudo o que foi calculado com as anteriores.
      return { ...estado, versao: acao.versao, notas: acao.notas, classificacao: null, recomendacoes: null, orientacao: null, pendente: SEM_PENDENCIAS, falha: {}, aviso: null }
    case 'inicio':
      return { ...estado, pendente: { ...estado.pendente, [acao.operacao]: true }, falha: { ...estado.falha, [acao.operacao]: undefined }, aviso: null }
    case 'classificado':
      // Um novo nível torna as recomendações anteriores obsoletas.
      return { ...estado, classificacao: acao.dados, recomendacoes: null, pendente: { ...estado.pendente, classificacao: false } }
    case 'recomendado':
      if (estado.classificacao !== acao.base) {
        return { ...estado, pendente: { ...estado.pendente, recomendacoes: false } }
      }
      return { ...estado, recomendacoes: acao.dados, pendente: { ...estado.pendente, recomendacoes: false } }
    case 'orientado':
      return { ...estado, orientacao: { pergunta: acao.pergunta, resposta: acao.dados }, pendente: { ...estado.pendente, orientacao: false } }
    case 'falha':
      return { ...estado, falha: { ...estado.falha, [acao.operacao]: acao.mensagem }, pendente: { ...estado.pendente, [acao.operacao]: false } }
    case 'fim':
      return { ...estado, pendente: { ...estado.pendente, [acao.operacao]: false }, aviso: acao.aviso ?? estado.aviso }
    case 'descartar':
      return { ...INICIAL, versao: acao.versao, aviso: acao.motivo }
    case 'limparAviso':
      return { ...estado, aviso: null }
  }
}

function completas(notas: EstadoJornada['notas']): Competencias | null {
  const { logica, comunicacao, tecnologia } = notas
  return logica && comunicacao && tecnologia ? { logica, comunicacao, tecnologia } : null
}

/**
 * Notas e resultados de IA da sessão, só em memória. Cada operação tem um `AbortController` e um
 * número de chamada: uma resposta só é aplicada se ainda for a chamada mais recente daquela operação
 * e se a jornada não tiver sido descartada ou alterada desde o envio.
 */
export function JornadaProvider({ children }: { children: ReactNode }) {
  const { api, chave } = useSessaoApi()
  const { estado: sessao } = useAuth()
  const individual = sessao.status === 'autenticado' && sessao.tipoConta === 'COLABORADOR_INDIVIDUAL'
  const consentimento = useConsentimento({ acompanhar: individual, habilitado: individual })
  const queryClient = useQueryClient()
  const [estado, despachar] = useReducer(reduzir, INICIAL)
  const estadoRef = useRef(estado)
  const versaoRef = useRef(0)
  const controles = useRef<Partial<Record<OperacaoIa, AbortController>>>({})
  const chamadas = useRef<Record<OperacaoIa, number>>({ classificacao: 0, recomendacoes: 0, orientacao: 0 })

  useEffect(() => {
    estadoRef.current = estado
  })

  const abortarTodas = useCallback(() => {
    for (const operacao of Object.keys(controles.current) as OperacaoIa[]) {
      controles.current[operacao]?.abort()
      chamadas.current[operacao] += 1
    }
    controles.current = {}
  }, [])

  // Ao desmontar (logout, troca de usuário), nada continua esperando.
  useEffect(() => abortarTodas, [abortarTodas])

  const descartar = useCallback(
    (motivo: AvisoJornada) => {
      abortarTodas()
      versaoRef.current += 1
      despachar({ tipo: 'descartar', motivo, versao: versaoRef.current })
    },
    [abortarTodas],
  )

  // A confirmação negativa vale em qualquer tela, mesmo com uma chamada de IA em andamento.
  useLayoutEffect(() => {
    if (consentimento.isSuccess && consentimento.data.autorizado === false && Object.keys(estado.notas).length > 0) {
      descartar('revogado')
    }
  }, [consentimento.data, consentimento.isSuccess, estado.notas, descartar])

  const executar = useCallback(
    async <T,>(operacao: OperacaoIa, chamar: (signal: AbortSignal) => Promise<T>, aplicar: (dados: T) => Acao) => {
      controles.current[operacao]?.abort()
      const controle = new AbortController()
      controles.current[operacao] = controle
      const chamada = (chamadas.current[operacao] += 1)
      const versao = versaoRef.current
      const atual = () => chamadas.current[operacao] === chamada && versaoRef.current === versao
      despachar({ tipo: 'inicio', operacao })
      try {
        const dados = await chamar(controle.signal)
        if (atual()) despachar(aplicar(dados))
      } catch (erro) {
        if (!atual()) return
        if (ehApiError(erro) && erro.tipo === 'cancelado') {
          despachar({ tipo: 'fim', operacao })
        } else if (ehApiError(erro) && erro.codigo === 'CONSENTIMENTO_IA_NECESSARIO') {
          // O backend recusou: bloqueia já, mesmo que o cache ainda diga “autorizado”.
          descartar('consentimento-necessario')
          void queryClient.invalidateQueries({ queryKey: chaveConsentimento(chave) })
        } else {
          despachar({ tipo: 'falha', operacao, mensagem: mensagemDeErro(erro) })
        }
      } finally {
        if (controles.current[operacao] === controle) delete controles.current[operacao]
      }
    },
    [chave, descartar, queryClient],
  )

  const valor = useMemo<ValorJornada>(() => {
    const competenciasCompletas = completas(estado.notas)
    return {
      ...estado,
      competenciasCompletas,
      definirNota(campo, nota) {
        if (estadoRef.current.notas[campo] === nota) return
        abortarTodas()
        versaoRef.current += 1
        despachar({ tipo: 'nota', notas: { ...estadoRef.current.notas, [campo]: nota }, versao: versaoRef.current })
      },
      async classificar() {
        const notas = completas(estadoRef.current.notas)
        if (!notas) return
        await executar('classificacao', (signal) => classificar(api, notas, signal), (dados) => ({ tipo: 'classificado', dados }))
      },
      async recomendar() {
        const notas = completas(estadoRef.current.notas)
        const base = estadoRef.current.classificacao
        if (!notas || !base) return
        await executar('recomendacoes', (signal) => recomendar(api, notas, base.nivel, signal), (dados) => ({ tipo: 'recomendado', dados, base }))
      },
      async orientar(pergunta) {
        const notas = completas(estadoRef.current.notas)
        if (!notas) return
        await executar('orientacao', (signal) => orientar(api, pergunta, notas, signal), (dados) => ({ tipo: 'orientado', pergunta, dados }))
      },
      cancelar(operacao) {
        controles.current[operacao]?.abort()
        delete controles.current[operacao]
        chamadas.current[operacao] += 1
        despachar({ tipo: 'fim', operacao, aviso: operacao === 'orientacao' ? 'orientacao-cancelada' : undefined })
      },
      descartar,
      limparAviso: () => despachar({ tipo: 'limparAviso' }),
    }
  }, [estado, api, abortarTodas, executar, descartar])

  return <JornadaContext value={valor}>{children}</JornadaContext>
}
