import { screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { renderizarAutenticado } from '@/test/app'

vi.mock('@/features/cursos/PaginaCursos', () => {
  throw new Error('Detalhe interno do carregamento')
})

it('trata a rejeição do import da rota e oferece recarregamento manual', async () => {
  const recarregar = vi.fn()
  const localizacao = window.location
  vi.stubGlobal('location', { origin: localizacao.origin, reload: recarregar })
  try {
    const { usuario } = renderizarAutenticado('ADMIN', '/cursos')
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar esta página')
    expect(screen.queryByText('Detalhe interno do carregamento')).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument()
    expect(recarregar).not.toHaveBeenCalled()
    await usuario.click(screen.getByRole('button', { name: 'Recarregar aplicação' }))
    expect(recarregar).toHaveBeenCalledOnce()
  } finally {
    vi.unstubAllGlobals()
  }
})
