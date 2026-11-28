import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { chamadas, corpoEnviado, json, problema, renderizarAutenticado } from '@/test/app'

// Respostas simuladas existem somente nestes testes.

const COLABORADORES = [
  { id: 3, nome: 'Bruno Teste', email: 'bruno.teste@example.com', cargo: 'Analista', departamento: 'Tecnologia', criadoEm: '2026-11-27T10:00:00.123456Z' },
  { id: 1, nome: 'Ana Teste', email: 'ana.teste@example.com', cargo: 'Coordenadora', departamento: 'Educação', criadoEm: '2026-11-26T10:00:00Z' },
  { id: 2, nome: 'Élio Teste', email: 'elio.teste@example.com', cargo: 'Analista', departamento: 'Educação', criadoEm: '2026-11-25T10:00:00Z' },
]

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const linhas = async () => {
  const tabela = await screen.findByRole('table')
  return within(tabela).getAllByRole('row').slice(1)
}

function adiado<T>() {
  let resolver: (valor: T) => void = () => {}
  const promessa = new Promise<T>((r) => {
    resolver = r
  })
  return { promessa, resolver }
}

describe('listagem', () => {
  it('lista os colaboradores em ordem alfabética com link para o detalhe', async () => {
    renderizarAutenticado('ADMIN', '/admin/colaboradores', { 'GET /api/colaboradores': () => json(COLABORADORES) })
    const todas = await linhas()
    expect(todas.map((linha) => within(linha).getByRole('rowheader').textContent)).toEqual(['Ana Teste', 'Bruno Teste', 'Élio Teste'])
    expect(within(todas[0] as HTMLElement).getByRole('link', { name: 'Ana Teste' })).toHaveAttribute('href', '/admin/colaboradores/1')
    expect(screen.getByText('3 de 3 colaboradores')).toBeInTheDocument()
  })

  it('busca sem acento por nome ou e-mail e filtra por departamento e cargo', async () => {
    const { usuario } = renderizarAutenticado('ADMIN', '/admin/colaboradores', { 'GET /api/colaboradores': () => json(COLABORADORES) })
    await linhas()

    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'elio')
    expect(await linhas()).toHaveLength(1)
    await usuario.clear(screen.getByRole('searchbox', { name: 'Buscar' }))
    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'bruno.teste@')
    expect(await linhas()).toHaveLength(1)
    await usuario.clear(screen.getByRole('searchbox', { name: 'Buscar' }))

    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Departamento' }), 'Educação')
    expect(await linhas()).toHaveLength(2)
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Cargo' }), 'Analista')
    const restantes = await linhas()
    expect(restantes).toHaveLength(1)
    expect(restantes[0]).toHaveTextContent('Élio Teste')

    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'ninguém')
    expect(screen.getByText('Nenhum colaborador encontrado')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(await linhas()).toHaveLength(3)
  })

  it('mostra estado vazio e erro com nova tentativa', async () => {
    let tentativas = 0
    const { usuario } = renderizarAutenticado('ADMIN', '/admin/colaboradores', {
      'GET /api/colaboradores': () => (++tentativas === 1 ? new Response(null, { status: 502 }) : json([])),
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('temporariamente indisponível')
    await usuario.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Nenhum colaborador cadastrado')).toBeInTheDocument()
  })
})

describe('cadastro', () => {
  async function abrir(rotas: Parameters<typeof renderizarAutenticado>[2]) {
    const app = renderizarAutenticado('ADMIN', '/admin/colaboradores', rotas)
    await screen.findByRole('heading', { level: 1, name: 'Colaboradores' })
    await app.usuario.click(screen.getByRole('button', { name: 'Cadastrar colaborador' }))
    const painel = await screen.findByRole('dialog', { name: 'Cadastrar colaborador' })
    return { ...app, painel }
  }

  async function preencher(usuario: ReturnType<typeof renderizarAutenticado>['usuario'], painel: HTMLElement, email = '  Pessoa.Teste@Example.com ') {
    await usuario.type(within(painel).getByLabelText('Nome'), 'Pessoa de Teste Evolia')
    await usuario.type(within(painel).getByLabelText('E-mail'), email)
    await usuario.type(within(painel).getByLabelText('Cargo'), 'Analista de teste')
    await usuario.type(within(painel).getByLabelText('Departamento'), 'Qualidade')
  }

  it('valida os campos conforme o backend', async () => {
    const { usuario, painel, fetchMock } = await abrir({ 'GET /api/colaboradores': () => json([]) })
    await usuario.click(within(painel).getByRole('button', { name: 'Cadastrar colaborador' }))
    expect(await within(painel).findByText('Informe o nome.')).toBeInTheDocument()
    expect(within(painel).getByText('Informe o e-mail.')).toBeInTheDocument()
    expect(within(painel).getByText('Informe o cargo.')).toBeInTheDocument()
    expect(within(painel).getByText('Informe o departamento.')).toBeInTheDocument()

    await usuario.type(within(painel).getByLabelText('E-mail'), 'sem-arroba')
    await usuario.type(within(painel).getByLabelText('Cargo'), 'c'.repeat(101))
    await usuario.click(within(painel).getByRole('button', { name: 'Cadastrar colaborador' }))
    expect(await within(painel).findByText('Informe um e-mail válido.')).toBeInTheDocument()
    expect(within(painel).getByText('Use no máximo 100 caracteres.')).toBeInTheDocument()
    expect(chamadas(fetchMock).some((c) => c.startsWith('POST'))).toBe(false)
  })

  it('envia dados normalizados, invalida a lista e oferece criar a conta', async () => {
    let lista: unknown[] = []
    const { usuario, painel, fetchMock } = await abrir({
      'GET /api/colaboradores': () => json(lista),
      'POST /api/colaboradores': () => {
        const criado = { id: 42, nome: 'Pessoa de Teste Evolia', email: 'pessoa.teste@example.com', cargo: 'Analista de teste', departamento: 'Qualidade', criadoEm: '2026-11-27T14:00:00.000001Z' }
        lista = [criado]
        return json(criado, 201)
      },
    })
    await preencher(usuario, painel)
    await usuario.click(within(painel).getByRole('button', { name: 'Cadastrar colaborador' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(corpoEnviado(fetchMock, 'POST /api/colaboradores')).toEqual({
      nome: 'Pessoa de Teste Evolia',
      email: 'pessoa.teste@example.com',
      cargo: 'Analista de teste',
      departamento: 'Qualidade',
    })
    expect(screen.getByText('Colaborador cadastrado')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Criar conta individual' })).toHaveAttribute('href', '/admin/contas?colaborador=42')
    expect(await linhas()).toHaveLength(1)
  })

  it('mostra e-mail duplicado no campo e não repete o envio', async () => {
    const resposta = adiado<Response>()
    const { usuario, painel, fetchMock } = await abrir({
      'GET /api/colaboradores': () => json(COLABORADORES),
      'POST /api/colaboradores': () => resposta.promessa,
    })
    await preencher(usuario, painel, 'ana.teste@example.com')
    await usuario.click(within(painel).getByRole('button', { name: 'Cadastrar colaborador' }))
    const enviando = await within(painel).findByRole('button', { name: 'Cadastrando…' })
    expect(enviando).toBeDisabled()
    await act(async () => {
      resposta.resolver(problema(409, 'EMAIL_DUPLICADO'))
    })

    const email = within(painel).getByLabelText('E-mail')
    expect(await within(painel).findByText('Já existe um colaborador com este e-mail.')).toBeInTheDocument()
    expect(email).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(email).toHaveFocus())
    expect(within(painel).queryByRole('alert')).toBeNull()
    expect(chamadas(fetchMock).filter((c) => c === 'POST /api/colaboradores')).toHaveLength(1)
  })
})

describe('detalhe', () => {
  it('mostra os dados e o atalho para criar a conta', async () => {
    renderizarAutenticado('ADMIN', '/admin/colaboradores/1', { 'GET /api/colaboradores/1': () => json(COLABORADORES[1]) })
    expect(await screen.findByRole('heading', { level: 1, name: 'Ana Teste' })).toBeInTheDocument()
    expect(screen.getByText('ana.teste@example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Criar conta individual' })).toHaveAttribute('href', '/admin/contas?colaborador=1')
    expect(within(screen.getByRole('navigation', { name: 'Trilha de navegação' })).getByText('Detalhes do colaborador')).toBeInTheDocument()
  })

  it('trata 404 e identificador inválido', async () => {
    renderizarAutenticado('ADMIN', '/admin/colaboradores/77', { 'GET /api/colaboradores/77': () => problema(404, 'COLABORADOR_NAO_ENCONTRADO') })
    expect(await screen.findByText('Colaborador não encontrado')).toBeInTheDocument()
  })

  it('colaborador não acessa o detalhe administrativo', async () => {
    const { fetchMock } = renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/admin/colaboradores/1')
    expect(await screen.findByText('Seu perfil não tem acesso a esta área.')).toBeInTheDocument()
    expect(chamadas(fetchMock)).not.toContain('GET /api/colaboradores/1')
  })
})
