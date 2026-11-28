import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { useSessaoApi } from '@/features/auth/contexto'
import { dataIso } from '@/lib/validacao'

/**
 * `ConsentimentoService.Decisao`: `{ autorizado, decididoEm }`, com `decididoEm` sempre presente
 * (`@JsonInclude(ALWAYS)`) e `null` antes da primeira decisão.
 */
const esquemaConsentimento = z.object({
  autorizado: z.boolean(),
  decididoEm: dataIso.nullable(),
})

export type Consentimento = z.infer<typeof esquemaConsentimento>

export const lerConsentimento = (dados: unknown): Consentimento => esquemaConsentimento.parse(dados)

export function chaveConsentimento(chave: readonly unknown[]) {
  return [...chave, 'consentimento'] as const
}

export function useConsentimento({ acompanhar = false, habilitado = true } = {}) {
  const { api, chave } = useSessaoApi()
  return useQuery({
    queryKey: chaveConsentimento(chave),
    queryFn: ({ signal }) => api.obter('/api/me/consentimento', lerConsentimento, { signal }),
    enabled: habilitado,
    // O observador da jornada permanece montado. Navegar entre telas não exige outro GET.
    refetchOnMount: false,
    refetchOnWindowFocus: acompanhar ? 'always' : false,
  })
}

/** Chave da mutation de decisão, usada para bloquear a IA enquanto a decisão é enviada. */
export function chaveDecisao(chave: readonly unknown[]) {
  return [...chave, 'consentimento', 'decisao'] as const
}

/**
 * `PUT /api/me/consentimento` com o corpo exato `{ autorizado }`. Sem retentativa. Em sucesso ou
 * falha, o estado real é consultado de novo.
 */
export function useDecidirConsentimento() {
  const { api, chave } = useSessaoApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: chaveDecisao(chave),
    mutationFn: (autorizado: boolean) => api.substituir('/api/me/consentimento', { autorizado }, lerConsentimento),
    onSettled: () => {
      if (!api.encerrada) {
        return queryClient.invalidateQueries({ queryKey: chaveConsentimento(chave) })
      }
    },
  })
}

export function useDecisaoPendente(): boolean {
  const { chave } = useSessaoApi()
  return useIsMutating({ mutationKey: chaveDecisao(chave) }) > 0
}
