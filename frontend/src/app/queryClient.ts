import { QueryClient } from '@tanstack/react-query'

/** Sem retentativas automáticas (API_CONTRACTS.md, seções 3 e 7) e sem refetch ao focar a janela. */
export function criarQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
}
