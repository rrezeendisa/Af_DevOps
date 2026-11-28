import { act, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { urlDaFoto } from '@/components/arte/fotos'
import { chamadas, corpoEnviado, json, renderizarAutenticado, type RotasSimuladas } from '@/test/app'

// Respostas simuladas existem somente nestes testes.

const AUTORIZADO = { autorizado: true, decididoEm: '2026-11-27T18:00:00Z' }
const RECOMENDACOES = {
  recomendacoes: [
    { cursoId: 'CURSO-001', nome: 'Fundamentos de lógica', justificativa: 'Indicado para fortalecer a base lógica.' },
    { cursoId: 'CURSO-007', nome: 'Comunicação no trabalho', justificativa: 'Complementa a comunicação.' },
  ],
  fontes: ['curso-001.md', 'curso-007.md'],
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function adiado<T>() {
  let resolver: (valor: T) => void = () => {}
  const promessa = new Promise<T>((r) => {
    resolver = r
  })
  return { promessa, resolver }
}

const posts = (fetchMock: Parameters<typeof chamadas>[0], rota: string) => chamadas(fetchMock).filter((c) => c === `POST ${rota}`).length

function abrir(rotas: RotasSimuladas, caminho = '/competencias', strict = false) {
  return renderizarAutenticado(
    'COLABORADOR_INDIVIDUAL',
    caminho,
    {
      'GET /api/me/consentimento': () => json(AUTORIZADO),
      'POST /api/ia/classificacoes': () => json({ nivel: 'INTERMEDIARIO', versaoModelo: '1.0.0' }),
      ...rotas,
    },
    undefined,
    strict,
  )
}

async function avaliarEIr(usuario: ReturnType<typeof abrir>['usuario'], notas: [number, number, number] = [2, 4, 3]) {
  await screen.findByRole('button', { name: 'Classificar' })
  for (const [grupo, nota] of [['Lógica', notas[0]], ['Comunicação', notas[1]], ['Tecnologia', notas[2]]] as const) {
    await usuario.click(within(screen.getByRole('group', { name: grupo })).getByRole('radio', { name: String(nota) }))
  }
  await usuario.click(screen.getByRole('button', { name: 'Classificar' }))
  await usuario.click(await screen.findByRole('link', { name: 'Ver recomendações' }))
  await screen.findByRole('heading', { level: 1, name: 'Recomendações para você' })
}

describe('recomendações', () => {
  it('sem classificação na sessão, leva à avaliação sem chamar a IA', async () => {
    const { fetchMock } = abrir({}, '/recomendacoes')
    expect(await screen.findByText('Faça a avaliação primeiro')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fazer a avaliação' })).toHaveAttribute('href', '/competencias')
    expect(posts(fetchMock, '/api/ia/recomendacoes')).toBe(0)
  })

  it('reutiliza notas e nível da sessão, sem disparo automático, e mostra cursos, códigos e fontes', async () => {
    const { usuario, fetchMock } = abrir({ 'POST /api/ia/recomendacoes': () => json(RECOMENDACOES) }, '/competencias', true)
    await avaliarEIr(usuario)

    expect(screen.getByText('Lógica 2 · Comunicação 4 · Tecnologia 3 · Nível estimado Intermediário')).toBeInTheDocument()
    expect(posts(fetchMock, '/api/ia/recomendacoes')).toBe(0)

    await usuario.click(screen.getByRole('button', { name: 'Gerar recomendações' }))
    const lista = await screen.findByRole('list', { name: 'Cursos recomendados' })
    const cursos = within(lista).getAllByRole('article')
    expect(cursos).toHaveLength(2)
    expect(cursos[0]).toHaveTextContent('Fundamentos de lógica')
    expect(cursos[0]).toHaveTextContent('Código no acervo: CURSO-001')
    expect(cursos[0]).toHaveTextContent('Indicado para fortalecer a base lógica.')
    expect(within(lista).queryAllByRole('link')).toHaveLength(0)
    const fontes = screen.getByRole('region', { name: 'Fontes consultadas' })
    expect(within(fontes).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['curso-001.md', 'curso-007.md'])
    expect(corpoEnviado(fetchMock, 'POST /api/ia/recomendacoes')).toEqual({ logica: 2, comunicacao: 4, tecnologia: 3, nivel: 'INTERMEDIARIO' })
    expect(posts(fetchMock, '/api/ia/recomendacoes')).toBe(1)
  })

  it('um só curso, sem categoria, nível ou carga horária inventados e sem fonte atribuída a ele', async () => {
    const { usuario } = abrir({ 'POST /api/ia/recomendacoes': () => json({ recomendacoes: [RECOMENDACOES.recomendacoes[0]], fontes: ['curso-001.md'] }) })
    await avaliarEIr(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Gerar recomendações' }))
    const cartao = within(await screen.findByRole('list', { name: 'Cursos recomendados' })).getByRole('article')
    expect(cartao.textContent).not.toMatch(/\.md|Básico|Intermediário|Avançado|\d+\s?h\b/)
    expect(within(cartao).queryByRole('link')).toBeNull()
  })

  it('lista vazia e sem fontes têm estados próprios', async () => {
    const { usuario } = abrir({ 'POST /api/ia/recomendacoes': () => json({ recomendacoes: [], fontes: [] }) })
    await avaliarEIr(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Gerar recomendações' }))
    expect(await screen.findByText('Nenhum curso compatível')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma fonte informada.')).toBeInTheDocument()
  })

  it('renderiza justificativas e fontes como texto puro', async () => {
    const html = '<b>negrito</b><img src="x" onerror="alert(1)">'
    const { usuario, container } = abrir({
      'POST /api/ia/recomendacoes': () =>
        json({ recomendacoes: [{ cursoId: 'CURSO-<i>9</i>', nome: 'Curso <script>x</script>', justificativa: html }], fontes: [html] }),
    })
    await avaliarEIr(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Gerar recomendações' }))
    expect(await screen.findByText(html, { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('Curso <script>x</script>')).toBeInTheDocument()
    // Só o conteúdo da página. As únicas imagens aceitas são as fotografias da própria interface.
    const conteudo = container.querySelector('main')!
    expect(conteudo.querySelector('b, script, i, [onerror]')).toBeNull()
    const permitidas = (['area-tecnologia', 'capa-seguranca', 'area-comunicacao', 'area-logica', 'experiencia-estudo'] as const).map((nome) => urlDaFoto(nome))
    for (const imagem of conteudo.querySelectorAll('img')) {
      expect(permitidas).toContain(imagem.getAttribute('src'))
      expect(imagem.getAttribute('alt')).toBe('')
    }
  })

  it('alterar uma nota descarta classificação e recomendações', async () => {
    const { usuario } = abrir({ 'POST /api/ia/recomendacoes': () => json(RECOMENDACOES) })
    await avaliarEIr(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Gerar recomendações' }))
    await screen.findByRole('list', { name: 'Cursos recomendados' })

    await usuario.click(screen.getByRole('link', { name: 'Alterar avaliação' }))
    await usuario.click(within(await screen.findByRole('group', { name: 'Lógica' })).getByRole('radio', { name: '5' }))
    await usuario.click(screen.getByRole('link', { name: 'Recomendações' }))
    expect(await screen.findByText('Faça a avaliação primeiro')).toBeInTheDocument()
  })

  it('recomendação atrasada de uma classificação anterior não aparece', async () => {
    const atrasada = adiado<Response>()
    const { usuario } = abrir({ 'POST /api/ia/recomendacoes': () => atrasada.promessa })
    await avaliarEIr(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Gerar recomendações' }))
    await screen.findByText('Buscando cursos nos documentos…')

    // Nova classificação com as mesmas notas: o nível pode mudar, então a recomendação antiga não vale.
    await usuario.click(screen.getByRole('link', { name: 'Alterar avaliação' }))
    await usuario.click(await screen.findByRole('button', { name: 'Classificar' }))
    await usuario.click(await screen.findByRole('link', { name: 'Ver recomendações' }))
    await act(async () => {
      atrasada.resolver(json(RECOMENDACOES))
    })

    expect(screen.queryByRole('list', { name: 'Cursos recomendados' })).toBeNull()
    expect(await screen.findByRole('button', { name: 'Gerar recomendações' })).toBeEnabled()
  })
})
