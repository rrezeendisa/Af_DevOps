import { useConsentimento, useDecisaoPendente } from './api'

export type AcessoIa = 'carregando' | 'indefinido' | 'erro' | 'negado' | 'liberado'

/**
 * Uma decisão em envio ou uma releitura em andamento impede o uso de um valor antigo do cache.
 */
export function useAcessoIa(): { acesso: AcessoIa; consulta: ReturnType<typeof useConsentimento> } {
  const consulta = useConsentimento()
  const decisaoPendente = useDecisaoPendente()

  let acesso: AcessoIa
  if (decisaoPendente) acesso = 'indefinido'
  else if (consulta.isPending) acesso = 'carregando'
  else if (consulta.fetchStatus !== 'idle') acesso = 'indefinido'
  else if (consulta.isError) acesso = 'erro'
  else acesso = consulta.data.autorizado ? 'liberado' : 'negado'

  return { acesso, consulta }
}
