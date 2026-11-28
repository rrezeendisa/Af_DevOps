import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarFetch, preencherLogin, renderizarApp } from '@/test/app'
import { servidorSimulado, type Conta } from '@/test/servidor'

// Respostas simuladas existem somente nestes testes.

const SENHA = 'senha-de-teste-1'
const CONTAS: Record<string, Conta> = {
  admin: { senha: SENHA, me: { nomeUsuario: 'admin', perfil: 'ADMIN' } },
  ana: { senha: SENHA, me: { nomeUsuario: 'ana', perfil: 'COLABORADOR', colaboradorId: 7 } },
  demo: { senha: SENHA, me: { nomeUsuario: 'demo', perfil: 'COLABORADOR' } },
}
const MARCADOR = 'evolia:logout-pendente'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

// Na área do colaborador, o título de nível 1 repete o da entrada; a seção própria é a de nível 2.
const titulo = (nome: string) => screen.findByRole('heading', { level: nome === 'Explore suas competências' ? 2 : 1, name: nome })
const landing = () => titulo('Inteligência que desenvolve pessoas.')

describe('landing pública em /', () => {
  it('aparece sem esperar a verificação da sessão e sem chamadas de negócio', async () => {
    const fetchMock = criarFetch()
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}))
    renderizarApp('/')
    expect(await landing()).toBeInTheDocument()
    for (const acesso of screen.getAllByRole('link', { name: 'Acessar plataforma' })) {
      expect(acesso).toHaveAttribute('href', '/entrar')
    }
    expect(screen.queryByRole('link', { name: 'Ir para minha área' })).toBeNull()
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me'])
  })

  it('para quem tem sessão, oferece ir para a área sem redirecionar nem buscar dados', async () => {
    const servidor = servidorSimulado(criarFetch(), CONTAS)
    servidor.abrir('demo')
    const { usuario } = renderizarApp('/')
    const acessos = await screen.findAllByRole('link', { name: 'Ir para minha área' })
    for (const link of acessos) expect(link).toHaveAttribute('href', '/inicio')
    expect(screen.queryByRole('link', { name: 'Acessar plataforma' })).toBeNull()
    const acesso = acessos[0] as HTMLElement
    expect(await landing()).toBeInTheDocument()
    expect(servidor.rotas()).toEqual(['GET /api/me'])

    await usuario.click(acesso)
    expect(await titulo('Explore suas competências')).toBeInTheDocument()
  })
})

describe('/inicio', () => {
  it.each([
    ['admin', 'Visão geral da Evolia'],
    ['ana', 'Explore suas competências'],
    ['demo', 'Explore suas competências'],
  ])('acesso direto com sessão restaurada (%s)', async (conta, esperado) => {
    const servidor = servidorSimulado(criarFetch(), CONTAS)
    servidor.abrir(conta)
    renderizarApp('/inicio')
    expect(await titulo(esperado)).toBeInTheDocument()
  })

  it('visitante vai para /entrar e, após o login, chega ao início', async () => {
    servidorSimulado(criarFetch(), CONTAS)
    const { usuario } = renderizarApp('/inicio')
    expect(await titulo('Que bom ter você aqui!')).toBeInTheDocument()
    await preencherLogin(usuario, 'admin', SENHA)
    expect(await titulo('Visão geral da Evolia')).toBeInTheDocument()
  })

  it('login iniciado em /entrar tem o início como destino padrão', async () => {
    servidorSimulado(criarFetch(), CONTAS)
    const { usuario } = renderizarApp('/entrar')
    await titulo('Que bom ter você aqui!')
    await preencherLogin(usuario, 'demo', SENHA)
    expect(await titulo('Explore suas competências')).toBeInTheDocument()
    expect(document.title).toBe('Início · Evolia')
  })

  it('logout volta para a tela de entrada', async () => {
    const servidor = servidorSimulado(criarFetch(), CONTAS)
    servidor.abrir('demo')
    const { usuario } = renderizarApp('/inicio')
    await titulo('Explore suas competências')
    await usuario.click(screen.getAllByRole('button', { name: 'Sair' })[0] as HTMLElement)
    expect(await titulo('Que bom ter você aqui!')).toBeInTheDocument()
    expect(servidor.rotas()).toContain('POST /api/logout')
  })
})

describe('logout pendente', () => {
  it('a landing continua visível e não restaura a sessão', async () => {
    localStorage.setItem(MARCADOR, 'true')
    const fetchMock = criarFetch()
    renderizarApp('/')
    expect(await landing()).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Acessar plataforma' }).length).toBeGreaterThan(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('/inicio não exibe nada privado e leva à tela de entrada', async () => {
    localStorage.setItem(MARCADOR, 'true')
    const fetchMock = criarFetch()
    renderizarApp('/inicio')
    expect(await titulo('Que bom ter você aqui!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar sair novamente' })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('rotas inexistentes', () => {
  it('visitante vai para a tela de entrada', async () => {
    servidorSimulado(criarFetch(), CONTAS)
    renderizarApp('/nao-existe')
    expect(await titulo('Que bom ter você aqui!')).toBeInTheDocument()
  })

  it.each(['/nao-existe', '/inicio/1'])('com sessão, %s mostra página não encontrada', async (caminho) => {
    const servidor = servidorSimulado(criarFetch(), CONTAS)
    servidor.abrir('demo')
    renderizarApp(caminho)
    expect(await titulo('Página não encontrada')).toBeInTheDocument()
  })
})
