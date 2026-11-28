import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { chamadas, corpoEnviado, json, problema, renderizarAutenticado, TOKEN_CSRF } from '@/test/app'

// Respostas simuladas existem somente nestes testes.

const CURSOS = [
  { id: 1, nome: 'Lógica para iniciantes', descricao: 'Fundamentos de raciocínio lógico.', cargaHoraria: 8, categoria: 'Tecnologia', nivel: 'BASICO', criadoEm: '2026-11-27T12:00:00.123456Z' },
  { id: 2, nome: 'Comunicação assertiva', descricao: 'Técnicas de comunicação no trabalho.', cargaHoraria: 12, categoria: 'Comportamento', nivel: 'INTERMEDIARIO', criadoEm: '2026-11-27T12:05:00Z' },
  { id: 3, nome: 'Arquitetura de software', descricao: 'Padrões avançados de projeto.', cargaHoraria: 40, categoria: 'Tecnologia', nivel: 'AVANCADO', criadoEm: '2026-11-27T12:10:00.5Z' },
]

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const listaCursos = () => screen.findByRole('list', { name: 'Cursos' })

function adiado<T>() {
  let resolver: (valor: T) => void = () => {}
  const promessa = new Promise<T>((r) => {
    resolver = r
  })
  return { promessa, resolver }
}

describe('catálogo', () => {
  it.each(['ADMIN', 'COLABORADOR_INDIVIDUAL', 'COLABORADOR_DEMONSTRACAO'] as const)('lista os cursos reais para %s', async (tipo) => {
    renderizarAutenticado(tipo, '/cursos', { 'GET /api/cursos': () => json(CURSOS) })
    const lista = await listaCursos()
    const cartoes = within(lista).getAllByRole('article')
    expect(cartoes).toHaveLength(3)
    expect(within(lista).getByRole('link', { name: 'Comunicação assertiva' })).toHaveAttribute('href', '/cursos/2')
    expect(within(cartoes[0] as HTMLElement).getByText('Básico')).toBeInTheDocument()
    expect(within(cartoes[0] as HTMLElement).getByText('8 horas')).toBeInTheDocument()
    expect(screen.getByText('3 de 3 cursos')).toBeInTheDocument()
  })

  it('filtra por busca sem acento, categoria e nível, e limpa filtros', async () => {
    const { usuario } = renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/cursos', { 'GET /api/cursos': () => json(CURSOS) })
    await listaCursos()

    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'comunicacao')
    expect(within(await listaCursos()).getAllByRole('article')).toHaveLength(1)
    expect(screen.getByText('1 de 3 cursos')).toBeInTheDocument()

    await usuario.clear(screen.getByRole('searchbox', { name: 'Buscar' }))
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Categoria' }), 'Tecnologia')
    expect(within(await listaCursos()).getAllByRole('article')).toHaveLength(2)

    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Nível' }), 'AVANCADO')
    const filtrados = within(await listaCursos()).getAllByRole('article')
    expect(filtrados).toHaveLength(1)
    expect(filtrados[0]).toHaveTextContent('Arquitetura de software')

    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'inexistente')
    expect(screen.getByText('Nenhum curso encontrado')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(within(await listaCursos()).getAllByRole('article')).toHaveLength(3)
  })

  it('mostra estado vazio quando não há cursos', async () => {
    renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/cursos', { 'GET /api/cursos': () => json([]) })
    expect(await screen.findByText('Nenhum curso cadastrado')).toBeInTheDocument()
  })

  it('mostra erro e permite tentar novamente', async () => {
    let tentativas = 0
    const { usuario } = renderizarAutenticado('ADMIN', '/cursos', {
      'GET /api/cursos': () => (++tentativas === 1 ? new Response(null, { status: 503 }) : json(CURSOS)),
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Serviço temporariamente indisponível')
    await usuario.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(within(await listaCursos()).getAllByRole('article')).toHaveLength(3)
  })

  it('trata resposta fora do contrato como erro', async () => {
    renderizarAutenticado('ADMIN', '/cursos', { 'GET /api/cursos': () => json([{ ...CURSOS[0], nivel: 'GESTOR' }]) })
    expect(await screen.findByRole('alert')).toHaveTextContent('resposta inesperada')
  })

  it.each(['COLABORADOR_INDIVIDUAL', 'COLABORADOR_DEMONSTRACAO'] as const)('%s não vê o cadastro', async (tipo) => {
    renderizarAutenticado(tipo, '/cursos', { 'GET /api/cursos': () => json(CURSOS) })
    await listaCursos()
    expect(screen.queryByRole('button', { name: 'Cadastrar curso' })).toBeNull()
  })
})

describe('cadastro (ADMIN)', () => {
  async function abrirFormulario(rotas: Parameters<typeof renderizarAutenticado>[2]) {
    const app = renderizarAutenticado('ADMIN', '/cursos', rotas)
    await screen.findByRole('heading', { level: 1, name: 'Cursos' })
    await app.usuario.click(screen.getByRole('button', { name: 'Cadastrar curso' }))
    const painel = await screen.findByRole('dialog', { name: 'Cadastrar curso' })
    return { ...app, painel }
  }

  it('valida os campos conforme o backend sem chamar a API', async () => {
    const { usuario, painel, fetchMock } = await abrirFormulario({ 'GET /api/cursos': () => json([]) })
    const enviar = within(painel).getByRole('button', { name: 'Cadastrar curso' })

    await usuario.click(enviar)
    expect(await within(painel).findByText('Informe o nome do curso.')).toBeInTheDocument()
    expect(within(painel).getByText('Informe a descrição.')).toBeInTheDocument()
    expect(within(painel).getByText('Informe a carga horária.')).toBeInTheDocument()
    expect(within(painel).getByText('Informe a categoria.')).toBeInTheDocument()
    expect(within(painel).getByText('Selecione o nível.')).toBeInTheDocument()

    await usuario.type(within(painel).getByLabelText('Nome'), 'a'.repeat(151))
    await usuario.type(within(painel).getByLabelText('Carga horária (horas)'), '1.5')
    await usuario.type(within(painel).getByLabelText('Descrição'), '   ')
    await usuario.click(enviar)
    expect(await within(painel).findByText('Use no máximo 150 caracteres.')).toBeInTheDocument()
    expect(within(painel).getByText('Use um número inteiro entre 1 e 2.147.483.647.')).toBeInTheDocument()
    expect(within(painel).getByText('Informe a descrição.')).toBeInTheDocument()

    expect(chamadas(fetchMock).filter((c) => c.startsWith('POST'))).toEqual([])
  })

  it('envia o corpo exato com CSRF, invalida a lista e confirma', async () => {
    let lista: unknown[] = []
    const { usuario, painel, fetchMock } = await abrirFormulario({
      'GET /api/cursos': () => json(lista),
      'POST /api/cursos': () => {
        const criado = { id: 9, nome: 'Curso de teste Evolia', descricao: 'Registro de teste.', cargaHoraria: 6, categoria: 'Teste', nivel: 'BASICO', criadoEm: '2026-11-27T13:00:00.000001Z' }
        lista = [criado]
        return json(criado, 201)
      },
    })

    await usuario.type(within(painel).getByLabelText('Nome'), '  Curso de teste Evolia  ')
    await usuario.type(within(painel).getByLabelText('Descrição'), 'Registro de teste.')
    await usuario.type(within(painel).getByLabelText('Carga horária (horas)'), '6')
    await usuario.selectOptions(within(painel).getByLabelText('Nível'), 'BASICO')
    await usuario.type(within(painel).getByLabelText('Categoria'), 'Teste ')
    await usuario.click(within(painel).getByRole('button', { name: 'Cadastrar curso' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText('Curso cadastrado')).toBeInTheDocument()
    expect(corpoEnviado(fetchMock, 'POST /api/cursos')).toEqual({
      nome: 'Curso de teste Evolia',
      descricao: 'Registro de teste.',
      cargaHoraria: 6,
      categoria: 'Teste',
      nivel: 'BASICO',
    })
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(new Headers(post?.[1]?.headers).get('X-XSRF-TOKEN')).toBe(TOKEN_CSRF)
    expect(within(await listaCursos()).getAllByRole('article')).toHaveLength(1)
    expect(chamadas(fetchMock).filter((c) => c === 'GET /api/cursos')).toHaveLength(2)
  })

  it('bloqueia duplo envio e não repete em erro', async () => {
    const resposta = adiado<Response>()
    const { usuario, painel, fetchMock } = await abrirFormulario({
      'GET /api/cursos': () => json([]),
      'POST /api/cursos': () => resposta.promessa,
    })
    await usuario.type(within(painel).getByLabelText('Nome'), 'Curso de teste')
    await usuario.type(within(painel).getByLabelText('Descrição'), 'Descrição de teste.')
    await usuario.type(within(painel).getByLabelText('Carga horária (horas)'), '4')
    await usuario.selectOptions(within(painel).getByLabelText('Nível'), 'AVANCADO')
    await usuario.type(within(painel).getByLabelText('Categoria'), 'Teste')

    await usuario.click(within(painel).getByRole('button', { name: 'Cadastrar curso' }))
    const enviando = await within(painel).findByRole('button', { name: 'Cadastrando…' })
    expect(enviando).toBeDisabled()
    await usuario.click(enviando)
    await act(async () => {
      resposta.resolver(problema(400, 'DADOS_INVALIDOS'))
    })

    expect(await within(painel).findByRole('alert')).toHaveTextContent('Alguns dados não foram aceitos')
    expect(chamadas(fetchMock).filter((c) => c === 'POST /api/cursos')).toHaveLength(1)
  })
})

describe('detalhe', () => {
  it('mostra os dados reais do curso', async () => {
    renderizarAutenticado('COLABORADOR_DEMONSTRACAO', '/cursos/2', { 'GET /api/cursos/2': () => json(CURSOS[1]) })
    expect(await screen.findByRole('heading', { level: 1, name: 'Comunicação assertiva' })).toBeInTheDocument()
    expect(screen.getByText('Comportamento')).toBeInTheDocument()
    expect(screen.getByText('12 horas')).toBeInTheDocument()
    expect(screen.getAllByText('Intermediário').length).toBeGreaterThan(0)
    const trilha = screen.getByRole('navigation', { name: 'Trilha de navegação' })
    expect(within(trilha).getByRole('link', { name: 'Cursos' })).toHaveAttribute('href', '/cursos')
    expect(within(trilha).getByText('Detalhes do curso')).toHaveAttribute('aria-current', 'page')
  })

  it('mostra curso não encontrado em 404', async () => {
    renderizarAutenticado('ADMIN', '/cursos/99', { 'GET /api/cursos/99': () => problema(404, 'CURSO_NAO_ENCONTRADO') })
    expect(await screen.findByText('Curso não encontrado')).toBeInTheDocument()
  })

  it.each(['/cursos/0', '/cursos/-1', '/cursos/abc', '/cursos/9007199254740992'])(
    'identificador inválido em %s não chama a API',
    async (caminho) => {
      const { fetchMock } = renderizarAutenticado('ADMIN', caminho)
      expect(await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )
})
