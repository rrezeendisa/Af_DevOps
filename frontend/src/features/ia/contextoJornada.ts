import { createContext, useContext } from 'react'
import type { CampoCompetencia, Classificacao, Competencias, Nota, Orientacao, Recomendacoes } from './api'

export type OperacaoIa = 'classificacao' | 'recomendacoes' | 'orientacao'

export type AvisoJornada = 'revogado' | 'consentimento-necessario' | 'orientacao-cancelada'

/**
 * Jornada de IA da sessão atual. Vive só em memória, dentro do `AppShell`, com `key` igual à
 * geração da sessão: logout e troca de usuário desmontam e descartam tudo.
 */
export type EstadoJornada = {
  /** Muda a cada descarte ou alteração de nota. Respostas de versões anteriores são ignoradas. */
  versao: number
  notas: Partial<Competencias>
  classificacao: Classificacao | null
  recomendacoes: Recomendacoes | null
  orientacao: { pergunta: string; resposta: Orientacao } | null
  pendente: Record<OperacaoIa, boolean>
  falha: Partial<Record<OperacaoIa, string>>
  aviso: AvisoJornada | null
}

export type ValorJornada = EstadoJornada & {
  competenciasCompletas: Competencias | null
  definirNota(campo: CampoCompetencia, nota: Nota): void
  classificar(): Promise<void>
  recomendar(): Promise<void>
  orientar(pergunta: string): Promise<void>
  /** Interrompe a espera da operação no frontend. Não garante a interrupção no servidor. */
  cancelar(operacao: OperacaoIa): void
  /** Aborta as operações e apaga notas e resultados. Não consulta o servidor. */
  descartar(motivo: AvisoJornada): void
  limparAviso(): void
}

export const JornadaContext = createContext<ValorJornada | null>(null)

export function useJornada(): ValorJornada {
  const valor = useContext(JornadaContext)
  if (valor === null) {
    throw new Error('useJornada precisa estar dentro de <JornadaProvider>.')
  }
  return valor
}
