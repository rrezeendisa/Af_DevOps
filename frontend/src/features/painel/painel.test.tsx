import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { chamadas, json, renderizarAutenticado } from '@/test/app'

// Respostas simuladas existem somente nestes testes.

const COLABORADORES = [1, 2, 3].map((id) => ({
  id,
  nome: `Pessoa ${id}`,
  email: `pessoa${id}@example.com`,
  cargo: 'Analista',
  departamento: 'Teste',
  criadoEm: '2026-11-27T10:00:00Z',
}))
const CURSOS = [1, 2].map((id) => ({
  id,
  nome: `Curso ${id}`,
  descricao: 'Descrição de teste.',
  cargaHoraria: 4,
  categoria: 'Teste',
  nivel: 'BASICO',
  criadoEm: '2026-11-27T10:00:00Z',
}))
const solicitacao = (id: number, status: string) => ({
  id,
  status,
  solicitadoPor: 'admin',
  versaoModelo: status === 'CONCLUIDO' ? '1.0.0' : null,
  mensagem: null,
  criadoEm: '2026-11-27T10:00:00Z',
  atualizadoEm: '2026-11-27T10:00:00Z',
})
const TREINAMENTOS = [solicitacao(1, 'CONCLUIDO'), solicitacao(2, 'CONCLUIDO'), solicitacao(3, 'FALHOU'), solicitacao(4, 'PENDENTE')]

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const panorama = () => screen.findByRole('region', { name: 'Panorama' })

describe('painel do ADMIN', () => {
  it('mostra os totais reais das três listas', async () => {
    renderizarAutenticado('ADMIN', '/inicio', {
      'GET /api/colaboradores': () => json(COLABORADORES),
      'GET /api/cursos': () => json(CURSOS),
      'GET /api/treinamentos': () => json(TREINAMENTOS),
    })
    await panorama()
    expect(await screen.findByTestId('total-/admin/colaboradores')).toHaveTextContent('3')
    expect(await screen.findByTestId('total-/cursos')).toHaveTextContent('2')
    expect(await screen.findByTestId('total-/admin/treinamentos')).toHaveTextContent('4')
  })

  it('mostra as contagens reais por status e a tabela, sem percentuais', async () => {
    renderizarAutenticado('ADMIN', '/inicio', {
      'GET /api/colaboradores': () => json([]),
      'GET /api/cursos': () => json([]),
      'GET /api/treinamentos': () => json(TREINAMENTOS),
    })
    const lista = await screen.findByRole('list', { name: 'Quantidade por status' })
    const itens = within(lista).getAllByRole('listitem').map((item) => item.textContent?.replace(/\s+/g, ' '))
    expect(itens).toEqual(['Pendentes: 1', 'Concluídas: 2', 'Com falha: 1'])
    const tabela = screen.getByRole('table', { name: 'Solicitações de treinamento mais recentes' })
    expect(within(tabela).getAllByRole('rowheader').map((c) => c.textContent)).toEqual(['#4', '#3', '#2', '#1'])
    expect(tabela.textContent).not.toMatch(/%/)
  })

  it('sem solicitações, informa que não há dados em vez de mostrar uma barra vazia', async () => {
    renderizarAutenticado('ADMIN', '/inicio', {
      'GET /api/colaboradores': () => json([]),
      'GET /api/cursos': () => json([]),
      'GET /api/treinamentos': () => json([]),
    })
    expect(await screen.findByText('Nenhuma solicitação ainda.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Quantidade por status' })).toBeNull()
    expect(await screen.findByTestId('total-/admin/treinamentos')).toHaveTextContent('0')
  })

  it('o erro em um indicador não derruba os outros e permite tentar novamente', async () => {
    let tentativas = 0
    const { usuario } = renderizarAutenticado('ADMIN', '/inicio', {
      'GET /api/colaboradores': () => json(COLABORADORES),
      'GET /api/cursos': () => (++tentativas === 1 ? new Response(null, { status: 503 }) : json(CURSOS)),
      'GET /api/treinamentos': () => json(TREINAMENTOS),
    })
    const secao = await panorama()
    expect(await within(secao).findByRole('alert')).toHaveTextContent('temporariamente indisponível')
    expect(await screen.findByTestId('total-/admin/colaboradores')).toHaveTextContent('3')
    expect(await screen.findByTestId('total-/admin/treinamentos')).toHaveTextContent('4')

    await usuario.click(within(secao).getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByTestId('total-/cursos')).toHaveTextContent('2')
  })

  it('leva às telas de cada indicador', async () => {
    renderizarAutenticado('ADMIN', '/inicio', {
      'GET /api/colaboradores': () => json([]),
      'GET /api/cursos': () => json([]),
      'GET /api/treinamentos': () => json([]),
    })
    const secao = await panorama()
    expect(within(secao).getByRole('link', { name: /Abrir colaboradores/ })).toHaveAttribute('href', '/admin/colaboradores')
    expect(within(secao).getByRole('link', { name: /Abrir cursos/ })).toHaveAttribute('href', '/cursos')
    expect(within(secao).getByRole('link', { name: /Abrir treinamentos/ })).toHaveAttribute('href', '/admin/treinamentos')
  })

  it('os atalhos só navegam: nenhum treinamento é solicitado ao abrir o painel ou a página', async () => {
    const { usuario, fetchMock } = renderizarAutenticado('ADMIN', '/inicio', {
      'GET /api/colaboradores': () => json([]),
      'GET /api/cursos': () => json([]),
      'GET /api/treinamentos': () => json([]),
    })
    const acoes = await screen.findByRole('region', { name: 'Ações rápidas' })
    await usuario.click(within(acoes).getByRole('link', { name: 'Solicitar treinamento' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Treinamentos' })).toBeInTheDocument()
    expect(chamadas(fetchMock).filter((chamada) => chamada.startsWith('POST'))).toEqual([])
  })

  it('“Novo colaborador” abre o formulário existente, sem enviar nada', async () => {
    const { usuario, fetchMock } = renderizarAutenticado('ADMIN', '/inicio', {
      'GET /api/colaboradores': () => json([]),
      'GET /api/cursos': () => json([]),
      'GET /api/treinamentos': () => json([]),
    })
    await usuario.click(await screen.findByRole('link', { name: 'Novo colaborador' }))
    expect(await screen.findByRole('dialog', { name: 'Cadastrar colaborador' })).toBeInTheDocument()
    expect(chamadas(fetchMock).filter((chamada) => chamada.startsWith('POST'))).toEqual([])

    // O pedido é consumido: sair da página e voltar a ela não reabre o formulário.
    await usuario.keyboard('{Escape}')
    const barra = screen.getByRole('complementary')
    await usuario.click(within(barra).getByRole('link', { name: 'Visão geral' }))
    await usuario.click(within(barra).getByRole('link', { name: 'Colaboradores' }))
    await screen.findByRole('heading', { level: 1, name: 'Colaboradores' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each([
    ['COLABORADOR_INDIVIDUAL', ['GET /api/me/consentimento']],
    ['COLABORADOR_DEMONSTRACAO', []],
  ] as const)('%s não vê o painel administrativo nem busca dados administrativos', async (tipo, esperadas) => {
    const { fetchMock } = renderizarAutenticado(tipo, '/inicio')
    expect(await screen.findByRole('heading', { level: 2, name: 'Explore suas competências' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Panorama' })).toBeNull()
    expect(chamadas(fetchMock)).toEqual(esperadas)
  })
})
