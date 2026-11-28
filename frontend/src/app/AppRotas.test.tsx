import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { criarFetch, itensDaSidebar, renderizarApp, renderizarAutenticado } from '@/test/app'
import { Hammer } from 'lucide-react'
import { PaginaPendente } from './paginas/PaginaPendente'
import { ROTAS } from './rotas'

// Respostas simuladas existem somente nestes testes.

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const negado = () => screen.queryByText('Seu perfil não tem acesso a esta área.')

describe('proteção das rotas', () => {
  it('anônimo em / vai para a tela de entrada', async () => {
    criarFetch().mockResolvedValue(new Response(null, { status: 401 }))
    renderizarApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
  })

  it.each(['/admin/colaboradores', '/admin/contas', '/admin/treinamentos'])(
    'colaborador que digita %s vê acesso negado, sem perder a sessão',
    async (caminho) => {
      const { valor } = renderizarAutenticado('COLABORADOR_INDIVIDUAL', caminho)
      expect(await screen.findByRole('alert')).toHaveTextContent('Seu perfil não tem acesso a esta área.')
      expect(valor.sair).not.toHaveBeenCalled()
      expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument()
    },
  )

  it.each(['/competencias', '/recomendacoes', '/orientacao', '/consentimento'])(
    'conta de demonstração não vê nem acessa %s',
    async (caminho) => {
      renderizarAutenticado('COLABORADOR_DEMONSTRACAO', caminho)
      await screen.findByText('Seu perfil não tem acesso a esta área.')
      expect(negado()).toBeInTheDocument()
      const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
      expect(within(nav).queryByRole('link', { name: /Competências|Recomendações|Orientação|Consentimento/ })).toBeNull()
    },
  )

  it('ADMIN não acessa as rotas de IA', async () => {
    renderizarAutenticado('ADMIN', '/orientacao')
    await screen.findByText('Seu perfil não tem acesso a esta área.')
    expect(negado()).toBeInTheDocument()
  })

  it.each(ROTAS.flatMap((rota) => rota.permitir.map((tipo) => [rota.caminho, tipo] as const)))(
    'rota %s abre para %s',
    async (caminho, tipo) => {
      renderizarAutenticado(tipo, caminho)
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
      expect(negado()).toBeNull()
    },
  )

  it('telas pendentes são identificadas, sem dados', () => {
    // Todas as rotas atuais estão implementadas; a página pendente é verificada com uma rota fictícia.
    const { fetchMock } = renderizarAutenticado('ADMIN', '/qualquer', {}, (
      <PaginaPendente
        rota={{ caminho: '/futura', titulo: 'Tela futura', icone: Hammer, permitir: ['ADMIN'], situacao: 'pendente', descricao: 'Descrição da tela futura.', tom: 'lima' }}
      />
    ))
    expect(screen.getByRole('heading', { level: 1, name: 'Tela futura' })).toBeInTheDocument()
    expect(screen.getAllByText('Em desenvolvimento').length).toBeGreaterThan(0)
    expect(screen.getByText('Esta área está em desenvolvimento')).toBeInTheDocument()
    expect(screen.getByText('Descrição da tela futura.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('nenhuma rota da tabela continua pendente', () => {
    expect(ROTAS.filter((rota) => rota.situacao === 'pendente')).toEqual([])
  })

  it('endereço desconhecido mostra página não encontrada', async () => {
    renderizarAutenticado('ADMIN', '/nao-existe')
    expect(await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
  })
})

describe('shell autenticado', () => {
  it.each([
    ['ADMIN', ['Visão geral', 'Colaboradores', 'Cursos', 'Contas', 'Treinamentos', 'Sair']],
    ['COLABORADOR_INDIVIDUAL', ['Minha área', 'Cursos', 'Competências', 'Recomendações', 'Orientação', 'Consentimento', 'Sair']],
    ['COLABORADOR_DEMONSTRACAO', ['Minha área', 'Cursos', 'Sair']],
  ] as const)('sidebar de %s', async (tipo, esperado) => {
    renderizarAutenticado(tipo)
    const sidebar = await screen.findByRole('complementary')
    const itens = within(sidebar).getAllByRole('link').map((link) => link.textContent)
    const botoes = within(sidebar).getAllByRole('button').map((botao) => botao.textContent)
    expect([...itens, ...botoes]).toEqual(esperado)
    expect(itensDaSidebar()).toEqual(esperado.slice(0, -1))
  })

  it('marca o item ativo e navega com breadcrumbs', async () => {
    const { usuario } = renderizarAutenticado('ADMIN')
    const sidebar = await screen.findByRole('complementary')
    expect(within(sidebar).getByRole('link', { name: 'Visão geral' })).toHaveAttribute('aria-current', 'page')
    const trilha = screen.getByRole('navigation', { name: 'Trilha de navegação' })
    expect(within(trilha).queryByRole('link')).toBeNull()
    expect(within(trilha).getByText('Início')).toHaveAttribute('aria-current', 'page')

    await usuario.click(within(sidebar).getByRole('link', { name: 'Colaboradores' }))

    expect(within(sidebar).getByRole('link', { name: 'Colaboradores' })).toHaveAttribute('aria-current', 'page')
    expect(within(sidebar).getByRole('link', { name: 'Visão geral' })).not.toHaveAttribute('aria-current')
    const novaTrilha = screen.getByRole('navigation', { name: 'Trilha de navegação' })
    expect(within(novaTrilha).getByRole('link', { name: 'Evolia' })).toHaveAttribute('href', '/')
    expect(within(novaTrilha).getByText('Colaboradores')).toHaveAttribute('aria-current', 'page')
    expect(document.title).toBe('Colaboradores · Evolia')
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('Sair na sidebar encerra a sessão', async () => {
    const { usuario, valor } = renderizarAutenticado('ADMIN')
    await usuario.click(within(await screen.findByRole('complementary')).getByRole('button', { name: 'Sair' }))
    expect(valor.sair).toHaveBeenCalledTimes(1)
  })

  it('menu do usuário mostra nome e tipo de conta e permite sair', async () => {
    const { usuario, valor } = renderizarAutenticado('COLABORADOR_DEMONSTRACAO')
    await usuario.click(await screen.findByRole('button', { name: 'Menu do usuário colab.demo' }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('colab.demo')).toBeInTheDocument()
    expect(within(menu).getByText('Conta de demonstração')).toBeInTheDocument()
    await usuario.click(within(menu).getByRole('menuitem', { name: 'Sair' }))
    expect(valor.sair).toHaveBeenCalledTimes(1)
  })

  it('oferece link para pular ao conteúdo', async () => {
    renderizarAutenticado('ADMIN')
    expect(await screen.findByRole('link', { name: 'Ir para o conteúdo' })).toHaveAttribute('href', '#conteudo')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo')
  })

  it('menu mobile abre em painel lateral e fecha com Esc', async () => {
    const { usuario } = renderizarAutenticado('COLABORADOR_INDIVIDUAL')
    const abrir = await screen.findByRole('button', { name: 'Abrir menu' })
    expect(abrir).toHaveAttribute('aria-expanded', 'false')

    await usuario.click(abrir)
    const painel = await screen.findByRole('dialog', { name: 'Menu' })
    expect(within(painel).getByRole('link', { name: 'Orientação' })).toBeInTheDocument()

    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull()
  })

  it('menu mobile fecha ao escolher um destino', async () => {
    const { usuario } = renderizarAutenticado('ADMIN')
    await usuario.click(await screen.findByRole('button', { name: 'Abrir menu' }))
    const painel = await screen.findByRole('dialog', { name: 'Menu' })
    await usuario.click(within(painel).getByRole('link', { name: 'Treinamentos' }))
    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Treinamentos' })).toBeInTheDocument()
  })

  it('menu mobile fecha em qualquer troca de rota, mesmo sem usar seus links', async () => {
    const { usuario } = renderizarAutenticado('ADMIN', '/', {
      'GET /api/colaboradores': () => new Response('[]', { headers: { 'Content-Type': 'application/json' } }),
      'GET /api/cursos': () => new Response('[]', { headers: { 'Content-Type': 'application/json' } }),
      'GET /api/treinamentos': () => new Response('[]', { headers: { 'Content-Type': 'application/json' } }),
    })
    const atalho = await screen.findByRole('link', { name: /Abrir cursos/ })
    await usuario.click(screen.getByRole('button', { name: 'Abrir menu' }))
    expect(await screen.findByRole('dialog', { name: 'Menu' })).toBeInTheDocument()

    fireEvent.click(atalho)

    expect(await screen.findByRole('heading', { level: 1, name: 'Cursos' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull()
  })

  it('não move o foco nem rola ao montar sob StrictMode', async () => {
    const rolar = vi.spyOn(window, 'scrollTo')
    renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/', {}, undefined, true)
    expect(await screen.findByRole('main')).not.toHaveFocus()
    expect(rolar).not.toHaveBeenCalled()
  })
})
