import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { criarFetch, renderizarApp } from '@/test/app'
import { REPOSITORIO, SECOES } from './dados'

// Respostas simuladas existem somente nestes testes.

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

async function abrir() {
  const fetchMock = criarFetch()
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }))
  const app = renderizarApp('/')
  await screen.findByRole('heading', { level: 1, name: 'Inteligência que desenvolve pessoas.' })
  return { ...app, fetchMock }
}

describe('estrutura da landing', () => {
  it('tem um único h1, as seções na ordem planejada e âncoras válidas', async () => {
    const { container, fetchMock } = await abrir()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    const ids = [...container.querySelectorAll('main section[id]')].map((s) => s.id)
    expect(ids).toEqual(['inicio', ...SECOES.map((s) => s.id)])
    for (const link of container.querySelectorAll('a[href^="#"]')) {
      expect(container.querySelector(link.getAttribute('href') as string)).not.toBeNull()
    }
    for (const secao of container.querySelectorAll('main section')) {
      expect(secao).toHaveAccessibleName()
    }
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
  })

  it('apresenta áreas, os cinco passos, os recursos de IA e o uso responsável', async () => {
    await abrir()
    const areas = screen.getByRole('region', { name: /Três áreas/ })
    expect(within(areas).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Tecnologia',
      'Comunicação',
      'Raciocínio lógico',
    ])
    const jornada = screen.getByRole('region', { name: /Um passo de cada vez/ })
    expect(within(jornada).getAllByRole('heading', { level: 3 })).toHaveLength(5)
    expect(within(jornada).getByText(/conta individual fornecida pela sua organização/)).toBeInTheDocument()
    expect(screen.getByText(/É uma estimativa, não uma avaliação de desempenho/)).toBeInTheDocument()
    expect(screen.getByText(/O que já foi enviado pode ter sido processado/)).toBeInTheDocument()
  })

  it('identifica as demonstrações e não mostra equipe, depoimentos ou métricas', async () => {
    const { container } = await abrir()
    expect(screen.getByText('Demonstração ilustrativa')).toBeInTheDocument()
    expect(screen.getAllByText('Ilustrativo').length).toBeGreaterThan(0)
    expect(screen.getByText(/exemplo ilustrativo/)).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/equipe respons|professor|depoimento|clientes|\d+\+|avaliações/i)
  })

  it('mostra as fotografias da experiência de aprendizagem, sem reservas provisórias', async () => {
    const { container } = await abrir()
    expect(container.querySelector('[data-foto-fallback]')).toBeNull()
    const secao = container.querySelector('#aprendizagem')!
    const fotos = [...secao.querySelectorAll('img')]
    expect(fotos.map((foto) => foto.getAttribute('src'))).toEqual([
      expect.stringContaining('experiencia-estudo'),
      expect.stringContaining('capa-seguranca'),
    ])
    for (const foto of fotos) expect(foto.getAttribute('alt')).toMatch(/^Mulher /)
  })

  it('mostra a escultura do hero sem reservas, com só a camada de cima levitando', async () => {
    const { container } = await abrir()
    const hero = container.querySelector('#inicio')!
    expect(hero.querySelector('[data-palco]')).toBeNull()
    const imagens = [...hero.querySelectorAll('img')]
    expect(imagens).toHaveLength(2)
    for (const imagem of imagens) {
      expect(imagem).toHaveAttribute('src', expect.stringContaining('hero-aprendizado'))
    }
    // A escultura é anunciada uma única vez.
    expect(screen.getAllByRole('img', { name: /Escultura das quatro pétalas/ })).toHaveLength(1)
    expect(hero.querySelector('[data-camada="pedestal"] img')).toHaveAttribute('alt', '')
    expect(hero.querySelector('[data-camada="escultura"] img')).toHaveClass('motion-safe:animate-flutuar')
    expect(hero.querySelector('[data-camada="pedestal"] img')).not.toHaveClass('motion-safe:animate-flutuar')
    expect(screen.getAllByText('Ilustrativo').length).toBeGreaterThanOrEqual(2)
  })

  it('cada área mostra a sua fotografia, descrita, fundida à superfície por véus decorativos', async () => {
    const { container } = await abrir()
    const areas = container.querySelector('#areas')!
    expect(areas.querySelector('[data-palco]')).toBeNull()
    const cartoes = [...areas.querySelectorAll('article')]
    const esperado = [
      ['area-tecnologia', /cabelo cacheado/],
      ['area-comunicacao', /barba e óculos/],
      ['area-logica', /blusa verde-lima/],
    ] as const
    expect(cartoes).toHaveLength(esperado.length)
    esperado.forEach(([arquivo, descricao], indice) => {
      const imagem = cartoes[indice]!.querySelector('img')!
      expect(imagem.getAttribute('src')).toContain(arquivo)
      expect(imagem.getAttribute('alt')).toMatch(descricao)
      expect(imagem).not.toHaveClass('motion-safe:animate-flutuar')
    })
    for (const veu of areas.querySelectorAll('[data-veu]')) {
      expect(veu).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('mostra o mascote no uso responsável', async () => {
    const { container } = await abrir()
    const robo = screen.getByRole('img', { name: /Mascote da Evolia IA comemorando/ })
    expect(container.querySelector('#uso-responsavel')).toContainElement(robo)
    expect(robo).toHaveClass('motion-safe:animate-flutuar')
  })

  it('apresenta o mascote junto da demonstração, com descrição e levitação só com movimento permitido', async () => {
    const { container } = await abrir()
    const mascote = screen.getByRole('img', { name: /Mascote da Evolia IA: um robô/ })
    expect(container.querySelector('#inteligencia')).toContainElement(mascote)
    expect(mascote).toHaveClass('motion-safe:animate-flutuar')
  })

  it('usa só recursos locais e compatíveis com a CSP', async () => {
    const { container } = await abrir()
    expect(container.querySelector('[style]')).toBeNull()
    for (const imagem of container.querySelectorAll('img')) {
      expect(imagem.getAttribute('src')).not.toMatch(/^(https?:|data:)/)
    }
    expect(screen.getByRole('link', { name: /Repositório no GitHub/ })).toHaveAttribute('href', REPOSITORIO)
    expect(screen.getByRole('link', { name: /Repositório no GitHub/ })).toHaveAttribute('rel', 'noreferrer')
  })
})

describe('navegação da landing', () => {
  it('oferece pular para o conteúdo e o CTA secundário leva às áreas', async () => {
    await abrir()
    expect(screen.getByRole('link', { name: 'Ir para o conteúdo' })).toHaveAttribute('href', '#conteudo')
    expect(screen.getByRole('link', { name: 'Conheça a Evolia' })).toHaveAttribute('href', '#areas')
    const nav = screen.getByRole('navigation', { name: 'Seções da página' })
    expect(within(nav).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(SECOES.map((s) => `#${s.id}`))
  })

  it('menu mobile abre, fecha com Esc e devolve o foco ao botão', async () => {
    const { usuario } = await abrir()
    const botao = screen.getByRole('button', { name: 'Abrir menu' })
    await usuario.click(botao)
    expect(await screen.findByRole('dialog', { name: 'Menu' })).toBeInTheDocument()
    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(botao).toHaveFocus()
  })

  it('escolher uma seção no menu fecha o painel e leva o foco para ela', async () => {
    const { usuario } = await abrir()
    await usuario.click(screen.getByRole('button', { name: 'Abrir menu' }))
    const painel = await screen.findByRole('dialog', { name: 'Menu' })
    await usuario.click(within(painel).getByRole('link', { name: 'Uso responsável' }))
    await vi.waitFor(() => expect(document.activeElement?.id).toBe('uso-responsavel'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
