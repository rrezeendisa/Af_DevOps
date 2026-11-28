import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { useSessaoApi } from '@/features/auth/contexto'
import { dataIso, idEntidade } from '@/lib/validacao'

/** `StatusTreinamento.java`. */
export const STATUS_TREINAMENTO = ['PENDENTE', 'CONCLUIDO', 'FALHOU'] as const
export type StatusTreinamento = (typeof STATUS_TREINAMENTO)[number]

/**
 * `SolicitacaoTreinamentoResponse.java`: (id, status, solicitadoPor, versaoModelo, mensagem,
 * criadoEm, atualizadoEm). `versaoModelo` e `mensagem` ficam `null` enquanto o worker não responde
 * (o Jackson serializa nulos). Limites do worker: versão até 50 e mensagem até 1000 caracteres.
 */
const esquemaSolicitacao = z.object({
  id: idEntidade,
  status: z.enum(STATUS_TREINAMENTO),
  solicitadoPor: z.string(),
  versaoModelo: z.string().nullable(),
  mensagem: z.string().nullable(),
  criadoEm: dataIso,
  atualizadoEm: dataIso,
})

export type SolicitacaoTreinamento = z.infer<typeof esquemaSolicitacao>

export const lerSolicitacao = (dados: unknown): SolicitacaoTreinamento => esquemaSolicitacao.parse(dados)
export const lerSolicitacoes = (dados: unknown): SolicitacaoTreinamento[] => z.array(esquemaSolicitacao).parse(dados)

/** Intervalo de atualização enquanto houver solicitação pendente. */
export const INTERVALO_POLLING_MS = 5_000

export function temPendente(solicitacoes: readonly SolicitacaoTreinamento[] | undefined): boolean {
  return solicitacoes?.some((s) => s.status === 'PENDENTE') ?? false
}

/**
 * Lista com polling **somente** enquanto houver `PENDENTE`. Com a aba oculta o intervalo pausa
 * (`refetchIntervalInBackground` falso); ao desmontar ou no logout a query deixa de existir.
 */
export function useTreinamentos() {
  const { api, chave } = useSessaoApi()
  return useQuery({
    queryKey: [...chave, 'treinamentos'],
    queryFn: ({ signal }) => api.obter('/api/treinamentos', lerSolicitacoes, { signal }),
    refetchInterval: (query) => (temPendente(query.state.data) ? INTERVALO_POLLING_MS : false),
    refetchIntervalInBackground: false,
  })
}

export function useTreinamento(id: number) {
  const { api, chave } = useSessaoApi()
  return useQuery({
    queryKey: [...chave, 'treinamentos', id],
    queryFn: ({ signal }) => api.obter(`/api/treinamentos/${id}`, lerSolicitacao, { signal }),
    refetchInterval: (query) => (query.state.data?.status === 'PENDENTE' ? INTERVALO_POLLING_MS : false),
    refetchIntervalInBackground: false,
  })
}

/**
 * `POST /api/treinamentos`, sem corpo. Também em erro a lista é recarregada: com 503
 * `FILA_INDISPONIVEL` o backend já registrou a solicitação como `FALHOU`. Nunca há reenvio.
 */
export function useSolicitarTreinamento() {
  const { api, chave } = useSessaoApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.enviar('/api/treinamentos', undefined, lerSolicitacao),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [...chave, 'treinamentos'] }),
  })
}
