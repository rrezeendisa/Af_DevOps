import { QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { ProvedorTema } from '@/components/tema/ProvedorTema'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { criarQueryClient } from './queryClient'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(criarQueryClient)
  return (
    <ProvedorTema>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ProvedorTema>
  )
}
