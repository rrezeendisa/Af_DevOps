import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { criarSessaoApi, type SessaoApi } from '@/lib/api/cliente'
import { codificarLogin, type Credenciais } from '@/lib/api/credenciais'
import { ehApiError } from '@/lib/api/erros'
import { AuthContext, type EstadoAuth, type MotivoFalhaLogin, type ResultadoLogin, type ValorAuth } from './contexto'
import { classificarConta, lerIdentidade, type Identidade } from './identidade'
import { CHAVE_SAIDA_PENDENTE, haSaidaPendente, marcadorConfiavel, marcarSaidaPendente } from './saidaPendente'
import { encerrarSessaoAnterior, repetirSaida, sairDaSessao } from './saidaServidor'

const CANAL = 'evolia:sessao'
/** Único conteúdo transmitido entre abas. */
const SINAL = 'sessao-alterada'
const CANCELADO: ResultadoLogin = { ok: false, motivo: 'cancelado' }

type Motivo = Extract<EstadoAuth, { status: 'anonimo' }>['motivo']

function motivoDaFalha(erro: unknown): MotivoFalhaLogin {
  if (!ehApiError(erro)) {
    return 'resposta-invalida'
  }
  if (erro.tipo === 'cancelado') {
    return 'cancelado'
  }
  if (erro.tipo === 'rede' || erro.tipo === 'tempo-limite') {
    return 'servico-indisponivel'
  }
  if (erro.tipo === 'http' && erro.status === 401) {
    return 'credenciais-invalidas'
  }
  if (erro.tipo === 'http' && erro.status === 429) {
    return 'muitas-tentativas'
  }
  if (erro.tipo === 'http' && erro.status !== undefined && erro.status >= 500) {
    return 'servico-indisponivel'
  }
  return 'resposta-invalida'
}

function estadoInicial(): EstadoAuth {
  return haSaidaPendente() ? { status: 'saida-pendente' } : { status: 'verificando' }
}

/**
 * Sessão do usuário. A autenticação fica no cookie HttpOnly; aqui só há identidade e contexto em memória.
 * Ao carregar a página, uma sessão válida é restaurada, salvo se houver logout sem confirmação.
 *
 * Toda mudança de sessão incrementa `geracao`: continuações antigas não alteram o estado. Login e
 * logout são executados um de cada vez, para o cookie do navegador nunca ser disputado nesta aba.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [estado, setEstado] = useState<EstadoAuth>(estadoInicial)
  const estadoRef = useRef(estado)
  const geracaoRef = useRef(0)
  /** Sessão em uso, em restauração ou aguardando confirmação. */
  const sessaoRef = useRef<SessaoApi | null>(null)
  /** Geração da sessão já autenticada. O 401 só encerra a sessão quando vem dela. */
  const autenticadaRef = useRef<number | null>(null)
  /** Sessão cujo logout não foi confirmado: o contexto dela impede encerrar a de outro usuário. */
  const saidaRef = useRef<SessaoApi | null>(null)
  const filaRef = useRef<Promise<unknown>>(Promise.resolve())
  const canalRef = useRef<BroadcastChannel | null>(null)
  const montadoRef = useRef(false)

  const definir = useCallback((novo: EstadoAuth) => {
    estadoRef.current = novo
    if (montadoRef.current) {
      setEstado(novo)
    }
  }, [])

  const anunciar = useCallback(() => {
    canalRef.current?.postMessage(SINAL)
  }, [])

  const emSerie = useCallback(<T,>(tarefa: () => Promise<T>): Promise<T> => {
    const execucao = filaRef.current.then(tarefa, tarefa)
    filaRef.current = execucao.catch(() => {})
    return execucao
  }, [])

  /** Aborta, cancela e limpa tudo o que é privado nesta aba. Devolve a sessão descartada. */
  const descartarSessaoAtual = useCallback((): SessaoApi | null => {
    const sessao = sessaoRef.current
    const geracaoAutenticada = autenticadaRef.current
    sessaoRef.current = null
    autenticadaRef.current = null
    // A ordem segue API_CONTRACTS.md, seção 6: abortar, cancelar queries, limpar o cache.
    sessao?.encerrar()
    const cancelamento = queryClient.cancelQueries()
    queryClient.clear()
    if (geracaoAutenticada !== null) {
      // Depois do cancelamento, remove o que uma continuação atrasada tenha gravado sob o prefixo antigo.
      void cancelamento.finally(() => {
        queryClient.removeQueries({ queryKey: ['sessao', geracaoAutenticada] })
      })
    }
    return sessao
  }, [queryClient])

  const novaSessao = useCallback(
    (geracao: number): SessaoApi =>
      criarSessaoApi({
        // O 401 do login e da restauração não passa daqui: a sessão ainda não está autenticada.
        aoNaoAutenticado: (codigo) => {
          if (geracaoRef.current !== geracao || autenticadaRef.current !== geracao) return
          geracaoRef.current += 1
          descartarSessaoAtual()
          definir({
            status: 'anonimo',
            motivo: codigo === 'SESSAO_SUBSTITUIDA' ? 'sessao-substituida' : 'sessao-expirada',
          })
        },
      }),
    [definir, descartarSessaoAtual],
  )

  const autenticado = useCallback(
    (geracao: number, sessao: SessaoApi, identidade: Identidade) => {
      autenticadaRef.current = geracao
      definir({ status: 'autenticado', identidade, tipoConta: classificarConta(identidade), api: sessao, geracao })
    },
    [definir],
  )

  const restaurar = useCallback(async () => {
    geracaoRef.current += 1
    const geracao = geracaoRef.current
    const sessao = novaSessao(geracao)
    sessaoRef.current = sessao
    try {
      const identidade = await sessao.retomar(lerIdentidade)
      if (geracaoRef.current !== geracao) return
      if (haSaidaPendente()) {
        descartarSessaoAtual()
        definir({ status: 'saida-pendente' })
      } else if (!marcadorConfiavel()) {
        definir({ status: 'confirmar', identidade })
      } else {
        autenticado(geracao, sessao, identidade)
      }
    } catch {
      if (geracaoRef.current !== geracao) return
      descartarSessaoAtual()
      definir({ status: 'anonimo', motivo: 'inicial' })
    }
  }, [autenticado, definir, descartarSessaoAtual, novaSessao])

  const entrar = useCallback(
    async (credenciais: Credenciais): Promise<ResultadoLogin> => {
      try {
        codificarLogin(credenciais)
      } catch {
        return { ok: false, motivo: 'credenciais-invalidas' }
      }
      geracaoRef.current += 1
      const geracao = geracaoRef.current
      descartarSessaoAtual()
      definir({ status: 'autenticando' })

      return emSerie(async (): Promise<ResultadoLogin> => {
        if (geracaoRef.current !== geracao || !montadoRef.current) return CANCELADO
        const falhou = (motivo: MotivoFalhaLogin): ResultadoLogin => {
          if (geracaoRef.current !== geracao) return CANCELADO
          descartarSessaoAtual()
          definir(haSaidaPendente() ? { status: 'saida-pendente' } : { status: 'anonimo', motivo: 'inicial' })
          return { ok: false, motivo }
        }
        // Nunca autentica por cima de outra sessão: a anterior precisa ser encerrada no servidor.
        try {
          if (await encerrarSessaoAnterior()) anunciar()
          saidaRef.current = null
        } catch {
          anunciar()
          return falhou('servico-indisponivel')
        }
        /** Um logout pedido durante este login continua valendo, mesmo que a página feche agora. */
        const cancelar = (): ResultadoLogin => {
          if (estadoRef.current.status === 'saindo') marcarSaidaPendente()
          return CANCELADO
        }
        if (geracaoRef.current !== geracao) return cancelar()

        const sessao = novaSessao(geracao)
        sessaoRef.current = sessao
        try {
          const identidade = await sessao.autenticar(credenciais, lerIdentidade)
          anunciar()
          // Substituída por outro login ou logout: a próxima operação encerra o que ficou no servidor.
          if (geracaoRef.current !== geracao || !montadoRef.current) return cancelar()
          if (identidade.nomeUsuario.toLowerCase() !== credenciais.nomeUsuario.toLowerCase()) {
            return falhou('resposta-invalida')
          }
          autenticado(geracao, sessao, identidade)
          return { ok: true }
        } catch (erro) {
          return falhou(motivoDaFalha(erro))
        }
      })
    },
    [anunciar, autenticado, definir, descartarSessaoAtual, emSerie, novaSessao],
  )

  const sair = useCallback(() => {
    const { status } = estadoRef.current
    if (status === 'saindo') return
    const repeticao = status === 'saida-pendente'
    geracaoRef.current += 1
    const geracao = geracaoRef.current
    const descartada = descartarSessaoAtual()
    const sessao = repeticao ? saidaRef.current : descartada
    // O marcador é gravado no próprio clique, antes de qualquer requisição.
    // Uma repetição nunca regrava: a ausência dele indica que outro login já assumiu o navegador.
    const jaPendente = haSaidaPendente()
    if (!repeticao) marcarSaidaPendente()
    definir({ status: 'saindo' })
    anunciar()

    void emSerie(async () => {
      try {
        if (!repeticao && (status === 'autenticado' || status === 'confirmar') && sessao !== null) {
          await sairDaSessao(sessao, jaPendente)
        } else if (repeticao) {
          await repetirSaida(sessao)
        } else {
          // Logout durante um login: encerra o que o login anterior tiver criado.
          marcarSaidaPendente()
          await encerrarSessaoAnterior()
        }
        saidaRef.current = null
        anunciar()
        if (geracaoRef.current === geracao) definir({ status: 'anonimo', motivo: 'logout' })
      } catch {
        // Depois de uma substituição, o contexto antigo não serve para a próxima tentativa.
        saidaRef.current = repeticao ? null : sessao
        anunciar()
        if (geracaoRef.current === geracao) definir({ status: 'saida-pendente' })
      }
    })
  }, [anunciar, definir, descartarSessaoAtual, emSerie])

  const continuar = useCallback(() => {
    const atual = estadoRef.current
    const sessao = sessaoRef.current
    if (atual.status !== 'confirmar' || sessao === null) return
    autenticado(geracaoRef.current, sessao, atual.identidade)
  }, [autenticado])

  /** Outra aba mudou a sessão. Nunca adota a nova identidade em silêncio. */
  const aoMudarEmOutraAba = useCallback(() => {
    const { status } = estadoRef.current
    // Login e logout em andamento nesta aba cuidam do próprio estado.
    if (status === 'autenticando' || status === 'saindo') return
    let proximo: Motivo | 'saida-pendente' | null = null
    if (haSaidaPendente()) proximo = 'saida-pendente'
    else if (status === 'saida-pendente') proximo = 'logout'
    else if (status !== 'anonimo') proximo = 'sessao-substituida'
    if (proximo === null || proximo === status) return
    geracaoRef.current += 1
    descartarSessaoAtual()
    definir(proximo === 'saida-pendente' ? { status: proximo } : { status: 'anonimo', motivo: proximo })
  }, [definir, descartarSessaoAtual])

  useEffect(() => {
    montadoRef.current = true
    // Sem BroadcastChannel, o filtro de contexto do servidor continua impedindo a troca silenciosa.
    const canal = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CANAL) : null
    canal?.addEventListener('message', (evento) => {
      if (evento.data === SINAL) aoMudarEmOutraAba()
    })
    canalRef.current = canal
    const aoMudarMarcador = (evento: StorageEvent) => {
      if (evento.key === CHAVE_SAIDA_PENDENTE || evento.key === null) aoMudarEmOutraAba()
    }
    window.addEventListener('storage', aoMudarMarcador)
    if (estadoRef.current.status === 'verificando') {
      void restaurar()
    }
    return () => {
      montadoRef.current = false
      geracaoRef.current += 1
      window.removeEventListener('storage', aoMudarMarcador)
      canal?.close()
      canalRef.current = null
      // Fechar a página não é logout: a sessão continua no servidor até expirar.
      descartarSessaoAtual()
    }
  }, [aoMudarEmOutraAba, descartarSessaoAtual, restaurar])

  const valor = useMemo<ValorAuth>(() => ({ estado, entrar, sair, continuar }), [estado, entrar, sair, continuar])

  return <AuthContext value={valor}>{children}</AuthContext>
}
