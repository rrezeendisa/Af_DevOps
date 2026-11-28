import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type ValorAuth } from '@/features/auth/contexto'
import { lerIdentidade, type TipoConta } from '@/features/auth/identidade'
import { JornadaProvider } from '@/features/ia/JornadaProvider'
import { criarSessaoApi } from '@/lib/api/cliente'
import { criarFetch, ME } from '@/test/app'
import { criarQueryClient } from '../queryClient'
import { rotasDe } from '../rotas'
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
    ['ADMIN', 'Gestão que transforma.', 'Educação corporativa inteligente'],
    ['COLABORADOR_INDIVIDUAL', 'Aprender é evoluir.', 'Sua jornada de desenvolvimento'],
    ['COLABORADOR_DEMONSTRACAO', 'Aprender é evoluir.', 'Sua jornada de desenvolvimento'],
  ] as const)('banner de %s', (tipo, titulo, subtitulo) => {
    renderizar(tipo)
    expect(screen.getByRole('heading', { level: 1, name: titulo })).toBeInTheDocument()
    expect(screen.getByText(subtitulo)).toBeInTheDocument()
    expect(screen.getByText(ME[tipo].nomeUsuario)).toBeInTheDocument()
  })

  it.each(['ADMIN', 'COLABORADOR_INDIVIDUAL', 'COLABORADOR_DEMONSTRACAO'] as const)(
    'acesso rápido de %s lista só rotas permitidas, marcando apenas as pendentes',
    (tipo) => {
      renderizar(tipo)
      const secao = screen.getByRole('region', { name: 'Acesso rápido' })
      const links = within(secao).getAllByRole('link')
      const esperadas = rotasDe(tipo).filter((rota) => rota.caminho !== '/inicio')
      expect(links.map((link) => link.getAttribute('href'))).toEqual(esperadas.map((rota) => rota.caminho))
      esperadas.forEach((rota, indice) => {
        const marcado = links[indice]?.textContent?.includes('Em desenvolvimento')
        expect(marcado).toBe(rota.situacao === 'pendente')
      })
    },
  )

  it('conta de demonstração vê o aviso sobre a conta individual e nenhum atalho de IA', () => {
    renderizar('COLABORADOR_DEMONSTRACAO')
    expect(screen.getByRole('status')).toHaveTextContent('disponíveis apenas para contas individuais')
    const secao = screen.getByRole('region', { name: 'Acesso rápido' })
    expect(within(secao).queryByRole('link', { name: /Orientação|Consentimento|Competências|Recomendações/ })).toBeNull()
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
