import { createContext, useContext } from 'react'
import type { SessaoApi } from '@/lib/api/cliente'
import type { Credenciais } from '@/lib/api/credenciais'
import type { Identidade, TipoConta } from './identidade'

export type EstadoAuth =
  /** Consultando se o navegador já tem uma sessão válida. */
  | { status: 'verificando' }
  | { status: 'anonimo'; motivo: 'inicial' | 'logout' | 'sessao-expirada' | 'sessao-substituida' }
  | { status: 'autenticando' }
  | { status: 'saindo' }
  /** O servidor não confirmou o logout: nada privado é exibido nem restaurado. */
  | { status: 'saida-pendente' }
  /** Sem armazenamento local, restaurar uma sessão exige confirmação. */
  | { status: 'confirmar'; identidade: Identidade }
  | {
      status: 'autenticado'
      identidade: Identidade
      tipoConta: TipoConta
      api: SessaoApi
      /** Identifica esta sessão. Prefixa as chaves de query (ver `useSessaoApi`). */
      geracao: number
    }

export type MotivoFalhaLogin =
  | 'credenciais-invalidas'
  | 'muitas-tentativas'
  | 'servico-indisponivel'
  | 'resposta-invalida'
  | 'cancelado'

export type ResultadoLogin = { ok: true } | { ok: false; motivo: MotivoFalhaLogin }

export type ValorAuth = {
  estado: EstadoAuth
  /** Encerra a sessão anterior e autentica. Nunca lança erro e nunca repete a tentativa. */
  entrar(credenciais: Credenciais): Promise<ResultadoLogin>
  /** Descarta o estado local e pede o logout ao servidor. Em `saida-pendente`, tenta de novo. */
  sair(): void
  /** Aceita a sessão mostrada no estado `confirmar`. */
  continuar(): void
}

export const AuthContext = createContext<ValorAuth | null>(null)

export function useAuth(): ValorAuth {
  const valor = useContext(AuthContext)
  if (valor === null) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>.')
  }
  return valor
}

/**
 * Sessão de API do usuário autenticado e o prefixo obrigatório das chaves de query dele.
 *
 * Regra para as features: toda chave de query começa com `chave`
 * (`[...chave, 'cursos']`), e todo `queryFn` usa este `api`, repassando o `signal` do TanStack Query.
 * Dados de uma sessão anterior ficam presos ao prefixo dela, que é removido no encerramento e
 * nunca é lido pela sessão atual.
 */
export function useSessaoApi(): { api: SessaoApi; chave: readonly ['sessao', number] } {
  const { estado } = useAuth()
  if (estado.status !== 'autenticado') {
    throw new Error('useSessaoApi exige uma sessão autenticada.')
  }
  return { api: estado.api, chave: ['sessao', estado.geracao] }
}
