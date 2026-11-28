import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type ValorAuth } from '@/features/auth/contexto'
import { lerIdentidade, type TipoConta } from '@/features/auth/identidade'
import { JornadaProvider } from '@/features/ia/JornadaProvider'
import { criarSessaoApi } from '@/lib/api/cliente'
import { criarFetch, ME } from '@/test/app'
import { criarQueryClient } from '../queryClient'
import { podeAcessar } from '../rotas'
import { Inicio } from './Inicio'

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderizar(tipoConta: TipoConta) {
  const fetchMock = criarFetch()
  const api = criarSessaoApi()
  const valor: ValorAuth = {
    estado: { status: 'autenticado', identidade: lerIdentidade(ME[tipoConta]), tipoConta, api, geracao: 1 },
    entrar: vi.fn(),
    sair: vi.fn(),
    continuar: vi.fn(),
  }
  const resultado = render(
    <QueryClientProvider client={criarQueryClient()}>
      <AuthContext value={valor}>
        <MemoryRouter>
          <JornadaProvider>
            <Inicio />
          </JornadaProvider>
        </MemoryRouter>
      </AuthContext>
    </QueryClientProvider>,
  )
  return { ...resultado, fetchMock }
}

describe('Início', () => {
  it.each([
    ['ADMIN', 'Visão geral da Evolia', 'Gerencie pessoas, conhecimento e inteligência artificial.'],
    ['COLABORADOR_INDIVIDUAL', 'Que bom ter você aqui!', 'Descubra novas possibilidades de desenvolvimento.'],
    ['COLABORADOR_DEMONSTRACAO', 'Que bom ter você aqui!', 'Descubra novas possibilidades de desenvolvimento.'],
  ] as const)('banner de %s', (tipo, titulo, subtitulo) => {
    renderizar(tipo)
    expect(screen.getByRole('heading', { level: 1, name: titulo })).toBeInTheDocument()
    expect(screen.getByText(subtitulo)).toBeInTheDocument()
  })

  it.each(['ADMIN', 'COLABORADOR_INDIVIDUAL', 'COLABORADOR_DEMONSTRACAO'] as const)('%s só recebe links para rotas permitidas', (tipo) => {
    renderizar(tipo)
    for (const link of screen.getAllByRole('link')) {
      expect(podeAcessar(link.getAttribute('href')!, tipo)).toBe(true)
    }
  })

  it('conta de demonstração vê o aviso sobre a conta individual e nenhum atalho de IA', () => {
    renderizar('COLABORADOR_DEMONSTRACAO')
    expect(screen.getByRole('status')).toHaveTextContent('disponíveis apenas para contas individuais')
    expect(screen.queryByRole('link', { name: /orientador|autorização|Avaliar competências/i })).toBeNull()
  })

  it('não mostra aviso de demonstração para outras contas', () => {
    renderizar('COLABORADOR_INDIVIDUAL')
    expect(screen.queryByText(/disponíveis apenas para contas individuais/)).toBeNull()
  })

  it('formas decorativas ficam ocultas e a conta de demonstração não dispara buscas na API', () => {
    const { container, fetchMock } = renderizar('COLABORADOR_DEMONSTRACAO')
    const decorativas = container.querySelectorAll('[data-decorativo]')
    expect(decorativas.length).toBeGreaterThan(0)
    for (const forma of decorativas) {
      expect(forma).toHaveAttribute('aria-hidden', 'true')
    }
    expect(screen.getByText('Inteligência que desenvolve pessoas.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
