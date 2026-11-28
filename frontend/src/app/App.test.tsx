import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { criarFetch, renderizarApp } from '@/test/app'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('leva o visitante anônimo à tela de entrada com a marca e o slogan da Evolia', async () => {
    const fetchMock = criarFetch()
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))
    renderizarApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getAllByText('Evolia').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Inteligência que desenvolve pessoas.').length).toBeGreaterThan(0)
    // Somente a consulta de restauração, sem escrita nem credenciais.
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([['/api/me', 'GET']])
  })
})
