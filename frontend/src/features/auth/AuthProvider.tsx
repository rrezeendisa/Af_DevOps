import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { criarSessaoApi, type SessaoApi } from '@/lib/api/cliente'
import type { Credenciais } from '@/lib/api/credenciais'
import { ehApiError } from '@/lib/api/erros'
import { AuthContext, type EstadoAuth, type MotivoFalhaLogin, type ResultadoLogin, type ValorAuth } from './contexto'
import { classificarConta, lerIdentidade } from './identidade'

const ESTADO_INICIAL: EstadoAuth = { status: 'anonimo', motivo: 'inicial' }
const CANCELADO: ResultadoLogin = { ok: false, motivo: 'cancelado' }

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
  if (erro.tipo === 'http' && erro.status !== undefined && erro.status >= 500) {
    return 'servico-indisponivel'
  }
  return 'resposta-invalida'
}

/**
 * Sessão do usuário. As credenciais vão direto para `criarSessaoApi` e não ficam guardadas aqui.
 * Nada é persistido no navegador: recarregar a página volta ao estado anônimo.
 *
 * Toda mudança de sessão (login, troca, logout, 401, desmontagem) incrementa `geracao`.
 * Continuações assíncronas de gerações antigas não alteram o estado.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [estado, setEstado] = useState<EstadoAuth>(ESTADO_INICIAL)
  const geracaoRef = useRef(0)
  /** Única referência viva à sessão (em login ou autenticada). */
  const sessaoRef = useRef<SessaoApi | null>(null)
  /** Geração da sessão já autenticada. O 401 só encerra a sessão quando vem dela. */
  const autenticadaRef = useRef<number | null>(null)
  const montadoRef = useRef(false)

  const descartarSessaoAtual = useCallback(() => {
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
  }, [queryClient])

  const encerrar = useCallback(
    (motivo: 'logout' | 'sessao-expirada') => {
      geracaoRef.current += 1
      descartarSessaoAtual()
      if (montadoRef.current) {
        setEstado({ status: 'anonimo', motivo })
      }
    },
    [descartarSessaoAtual],
  )

  const entrar = useCallback(
    async (credenciais: Credenciais): Promise<ResultadoLogin> => {
      geracaoRef.current += 1
      const geracao = geracaoRef.current
      // Login concorrente ou troca de usuário: a sessão anterior é encerrada antes de criar a nova.
      descartarSessaoAtual()

      let sessao: SessaoApi
      try {
        sessao = criarSessaoApi(credenciais, {
          // O 401 do próprio login não passa daqui: a sessão ainda não está autenticada.
          aoNaoAutenticado: () => {
            if (geracaoRef.current === geracao && autenticadaRef.current === geracao) {
              encerrar('sessao-expirada')
            }
          },
        })
      } catch {
        // Nome de usuário vazio ou com ':' não pode ser enviado em HTTP Basic.
        if (montadoRef.current) {
          setEstado(ESTADO_INICIAL)
        }
        return { ok: false, motivo: 'credenciais-invalidas' }
      }
      sessaoRef.current = sessao
      setEstado({ status: 'autenticando' })

      try {
        const identidade = await sessao.obter('/api/me', lerIdentidade)
        if (geracaoRef.current !== geracao || !montadoRef.current) {
          sessao.encerrar()
          return CANCELADO
        }
        autenticadaRef.current = geracao
        setEstado({
          status: 'autenticado',
          identidade,
          tipoConta: classificarConta(identidade),
          api: sessao,
          geracao,
        })
        return { ok: true }
      } catch (erro) {
        if (geracaoRef.current !== geracao) {
          // Substituída por outro login ou por logout, que já cuidaram da sessão e do estado.
          sessao.encerrar()
          return CANCELADO
        }
        sessaoRef.current = null
        sessao.encerrar()
        if (montadoRef.current) {
          setEstado(ESTADO_INICIAL)
        }
        return { ok: false, motivo: motivoDaFalha(erro) }
      }
    },
    [descartarSessaoAtual, encerrar],
  )

  const sair = useCallback(() => encerrar('logout'), [encerrar])

  useEffect(() => {
    // No StrictMode, a montagem dupla roda a limpeza com sessaoRef vazio, sem efeito real.
    montadoRef.current = true
    return () => {
      montadoRef.current = false
      geracaoRef.current += 1
      descartarSessaoAtual()
    }
  }, [descartarSessaoAtual])

  const valor = useMemo<ValorAuth>(() => ({ estado, entrar, sair }), [estado, entrar, sair])

  return <AuthContext value={valor}>{children}</AuthContext>
}
