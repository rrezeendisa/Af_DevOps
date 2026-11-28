import { act, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { json, renderizarAutenticado } from '@/test/app'

// Respostas simuladas existem somente nestes testes.

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const AUTORIZADO = { autorizado: true, decididoEm: '2026-11-27T18:00:00.123456Z' }

async function classificarEAbrirPainel(usuario: ReturnType<typeof renderizarAutenticado>['usuario']) {
  await screen.findByRole('button', { name: 'Classificar' })
  for (const grupo of ['Lógica', 'Comunicação', 'Tecnologia']) {
    await usuario.click(within(screen.getByRole('group', { name: grupo })).getByRole('radio', { name: '5' }))
  }
  await usuario.click(screen.getByRole('button', { name: 'Classificar' }))
  await screen.findByRole('region', { name: 'Nível estimado' })
  await usuario.click(within(screen.getByRole('complementary')).getByRole('link', { name: 'Início' }))
  return screen.findByRole('region', { name: 'Sua classificação' })
}

describe('painel do colaborador', () => {
  it('mostra o consentimento real e indica que ainda não há avaliação na sessão', async () => {
    renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/inicio', { 'GET /api/me/consentimento': () => json(AUTORIZADO) })
    const ia = await screen.findByRole('region', { name: 'Sua privacidade' })
    expect(await within(ia).findByText('Autorizado')).toBeInTheDocument()
    expect(within(ia).getByText(/^Desde /)).toBeInTheDocument()
    expect(within(ia).getByRole('link', { name: /Gerenciar autorização/ })).toHaveAttribute('href', '/consentimento')
    const orientador = screen.getByRole('region', { name: 'Seu orientador IA' })
    expect(within(orientador).getByRole('link', { name: /Abrir orientador/ })).toHaveAttribute('href', '/orientacao')

    const classificacao = screen.getByRole('region', { name: 'Sua classificação' })
    expect(classificacao).toHaveTextContent('Você ainda não fez a avaliação nesta sessão.')
    expect(within(classificacao).getByRole('link', { name: /Fazer a avaliação/ })).toHaveAttribute('href', '/competencias')
  })

  it('mostra não autorizado com orientação', async () => {
    renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/inicio', { 'GET /api/me/consentimento': () => json({ autorizado: false, decididoEm: null }) })
    const ia = await screen.findByRole('region', { name: 'Sua privacidade' })
    expect(await within(ia).findByText('Não autorizado')).toBeInTheDocument()
  })

  it('exibe a classificação feita nesta sessão, sem indicadores inventados', async () => {
    const { usuario } = renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/competencias', {
      'GET /api/me/consentimento': () => json(AUTORIZADO),
      'POST /api/ia/classificacoes': () => json({ nivel: 'AVANCADO', versaoModelo: '1.0.0' }),
    })
    const classificacao = await classificarEAbrirPainel(usuario)
    expect(classificacao).toHaveTextContent('Avançado(nível 3 de 3)')
    expect(classificacao).toHaveTextContent('Estimativa desta sessão · modelo 1.0.0')
    expect(classificacao.textContent).not.toMatch(/%/)
  })

  it.each(['negativa direta', 'falha seguida de negativa'])('descarta a classificação no retorno à aba após %s', async (cenario) => {
    const leitura = vi.fn<() => Response | Promise<Response>>(() => json(AUTORIZADO))
    const { usuario } = renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/competencias', {
      'GET /api/me/consentimento': leitura,
      'POST /api/ia/classificacoes': () => json({ nivel: 'AVANCADO', versaoModelo: '1.0.0' }),
    })
    const classificacao = await classificarEAbrirPainel(usuario)
    expect(classificacao).toHaveTextContent('Estimativa desta sessão')

    let responder: (resposta: Response) => void = () => {}
    leitura.mockReturnValueOnce(new Promise<Response>((resolver) => { responder = resolver }))
    fireEvent(document, new Event('visibilitychange', { bubbles: true }))
    expect(await within(classificacao).findByText('Verificando sua autorização…')).toBeInTheDocument()
    expect(classificacao).not.toHaveTextContent('Estimativa desta sessão')

    const negativa = () => json({ autorizado: false, decididoEm: '2026-11-27T19:00:00Z' })
    await act(async () => {
      responder(cenario === 'falha seguida de negativa' ? new Response(null, { status: 503 }) : negativa())
    })
    if (cenario === 'falha seguida de negativa') {
      expect(await within(classificacao).findByText('Classificação indisponível até confirmar sua autorização.')).toBeInTheDocument()
      leitura.mockImplementationOnce(negativa)
      fireEvent(document, new Event('visibilitychange', { bubbles: true }))
    }
    expect(await screen.findByText('Não autorizado')).toBeInTheDocument()
    expect(classificacao).not.toHaveTextContent('Estimativa desta sessão')

    fireEvent(document, new Event('visibilitychange', { bubbles: true }))
    expect(await screen.findByText('Autorizado')).toBeInTheDocument()
    expect(classificacao).toHaveTextContent('Você ainda não fez a avaliação nesta sessão.')
  })

  it('o conteúdo do colaborador individual só leva a rotas permitidas', async () => {
    renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/inicio', { 'GET /api/me/consentimento': () => json(AUTORIZADO) })
    await screen.findByRole('region', { name: 'Sua privacidade' })
    const destinos = new Set(within(screen.getByRole('main')).getAllByRole('link').map((l) => l.getAttribute('href')))
    expect([...destinos].sort()).toEqual(['/competencias', '/consentimento', '/cursos', '/orientacao'])
  })

  it('a conta de demonstração continua restrita ao início e ao catálogo', async () => {
    const { fetchMock } = renderizarAutenticado('COLABORADOR_DEMONSTRACAO', '/inicio')
    await screen.findByRole('heading', { level: 2, name: 'Explore suas competências' })
    for (const nome of ['Sua privacidade', 'Seu orientador IA', 'Sua classificação']) {
      expect(screen.queryByRole('region', { name: nome })).toBeNull()
    }
    const destinos = new Set(within(screen.getByRole('main')).getAllByRole('link').map((l) => l.getAttribute('href')))
    expect([...destinos]).toEqual(['/cursos'])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
