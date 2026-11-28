import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { chamadas, corpoEnviado, json, problema, renderizarAutenticado, type RotasSimuladas, TOKEN_CSRF } from '@/test/app'

// Respostas simuladas existem somente nestes testes.

const AUTORIZADO = { autorizado: true, decididoEm: '2026-11-27T18:00:00Z' }
const CLASSIFICACAO = { nivel: 'INTERMEDIARIO', versaoModelo: '1.0.0' }

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

function abrir(rotas: RotasSimuladas) {
  return renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/competencias', {
    'GET /api/me/consentimento': () => json(AUTORIZADO),
    ...rotas,
  })
}

const grupo = (nome: string) => screen.getByRole('group', { name: nome })
const posts = (fetchMock: Parameters<typeof chamadas>[0]) => chamadas(fetchMock).filter((c) => c === 'POST /api/ia/classificacoes').length

async function escolher(usuario: ReturnType<typeof abrir>['usuario'], logica: number, comunicacao: number, tecnologia: number) {
  await usuario.click(within(grupo('Lógica')).getByRole('radio', { name: String(logica) }))
  await usuario.click(within(grupo('Comunicação')).getByRole('radio', { name: String(comunicacao) }))
  await usuario.click(within(grupo('Tecnologia')).getByRole('radio', { name: String(tecnologia) }))
}

describe('classificação de competências', () => {
  it('sem consentimento, bloqueia e não chama a IA', async () => {
    const { fetchMock } = abrir({ 'GET /api/me/consentimento': () => json({ autorizado: false, decididoEm: null }) })
    expect(await screen.findByText('Autorização necessária')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Revisar consentimento' })).toHaveAttribute('href', '/consentimento')
    expect(screen.queryByRole('button', { name: 'Classificar' })).toBeNull()
    expect(posts(fetchMock)).toBe(0)
  })

  it('não pré-seleciona notas e só habilita a classificação com as três escolhidas', async () => {
    const { usuario } = abrir({})
    const botao = await screen.findByRole('button', { name: 'Classificar' })
    expect(screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toHaveLength(0)
    expect(botao).toBeDisabled()
    await usuario.click(within(grupo('Lógica')).getByRole('radio', { name: '2' }))
    await usuario.click(within(grupo('Comunicação')).getByRole('radio', { name: '4' }))
    expect(botao).toBeDisabled()
    await usuario.click(within(grupo('Tecnologia')).getByRole('radio', { name: '3' }))
    expect(botao).toBeEnabled()
    expect(grupo('Lógica')).toHaveAccessibleDescription('1 = pouco desenvolvida · 5 = muito desenvolvida')
  })

  it('permite escolher a nota pelo teclado', async () => {
    const { usuario } = abrir({})
    await screen.findByRole('button', { name: 'Classificar' })
    const tres = within(grupo('Lógica')).getByRole('radio', { name: '3' })
    await usuario.click(tres)
    await usuario.keyboard('{ArrowRight}')
    expect(within(grupo('Lógica')).getByRole('radio', { name: '4' })).toBeChecked()
  })

  it('envia só as três notas e mostra o nível estimado e a versão, sem percentuais', async () => {
    const { usuario, fetchMock } = abrir({ 'POST /api/ia/classificacoes': () => json(CLASSIFICACAO) })
    await screen.findByRole('button', { name: 'Classificar' })
    await escolher(usuario, 2, 4, 3)
    await usuario.click(screen.getByRole('button', { name: 'Classificar' }))

    const resultado = await screen.findByRole('region', { name: 'Nível estimado' })
    expect(resultado).toHaveTextContent('Intermediário(nível 2 de 3)')
    expect(resultado).toHaveTextContent('Versão do modelo: 1.0.0')
    expect(resultado).toHaveTextContent('Estimativa do modelo de classificação')
    expect(resultado).toHaveTextContent('diferente dos níveis Básico, Intermediário e Avançado dos cursos do catálogo')
    expect(resultado.textContent).not.toMatch(/%|precis|confian/i)
    expect(corpoEnviado(fetchMock, 'POST /api/ia/classificacoes')).toEqual({ logica: 2, comunicacao: 4, tecnologia: 3 })
    const post = fetchMock.mock.calls.find(([url]) => url === '/api/ia/classificacoes')
    expect(new Headers(post?.[1]?.headers).get('X-XSRF-TOKEN')).toBe(TOKEN_CSRF)
    expect(within(resultado).getByRole('link', { name: 'Ver recomendações' })).toHaveAttribute('href', '/recomendacoes')
  })

  it('mostra as notas informadas no resultado e “Limpar” apaga notas e resultado sem chamar a IA', async () => {
    const { usuario, fetchMock } = abrir({ 'POST /api/ia/classificacoes': () => json(CLASSIFICACAO) })
    await screen.findByRole('button', { name: 'Classificar' })
    expect(screen.getByRole('button', { name: 'Limpar' })).toBeDisabled()
    await escolher(usuario, 2, 4, 3)
    await usuario.click(screen.getByRole('button', { name: 'Classificar' }))
    const resultado = await screen.findByRole('region', { name: 'Nível estimado' })
    expect(resultado).toHaveTextContent('Lógica2Comunicação4Tecnologia3')

    await usuario.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(screen.queryByRole('region', { name: 'Nível estimado' })).toBeNull()
    expect(screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Classificar' })).toBeDisabled()
    expect(posts(fetchMock)).toBe(1)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(within(grupo('Lógica')).getByRole('radio', { name: '1' })).toHaveFocus()
    expect(screen.getByText('Avaliação limpa.')).toHaveAttribute('role', 'status')
  })

  it('alterar uma nota descarta o resultado anterior', async () => {
    const { usuario } = abrir({ 'POST /api/ia/classificacoes': () => json(CLASSIFICACAO) })
    await screen.findByRole('button', { name: 'Classificar' })
    await escolher(usuario, 2, 4, 3)
    await usuario.click(screen.getByRole('button', { name: 'Classificar' }))
    await screen.findByRole('region', { name: 'Nível estimado' })

    await usuario.click(within(grupo('Tecnologia')).getByRole('radio', { name: '5' }))
    expect(screen.queryByRole('region', { name: 'Nível estimado' })).toBeNull()
  })

  it('resposta atrasada depois de mudar uma nota não restaura o resultado', async () => {
    const resposta = adiado<Response>()
    const { usuario, fetchMock } = abrir({ 'POST /api/ia/classificacoes': () => resposta.promessa })
    await screen.findByRole('button', { name: 'Classificar' })
    await escolher(usuario, 2, 4, 3)
    await usuario.click(screen.getByRole('button', { name: 'Classificar' }))
    await screen.findByRole('button', { name: 'Classificando…' })
    const sinal = fetchMock.mock.calls.find(([url]) => url === '/api/ia/classificacoes')?.[1]?.signal

    await usuario.click(within(grupo('Lógica')).getByRole('radio', { name: '1' }))
    await act(async () => {
      resposta.resolver(json(CLASSIFICACAO))
    })

    expect(sinal?.aborted).toBe(true)
    expect(screen.queryByRole('region', { name: 'Nível estimado' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Classificar' })).toBeEnabled()
  })

  it('chamada substituída não sobrescreve o resultado mais recente', async () => {
    const primeira = adiado<Response>()
    let chamada = 0
    const { usuario, fetchMock } = abrir({
      'POST /api/ia/classificacoes': () => (++chamada === 1 ? primeira.promessa : json({ nivel: 'AVANCADO', versaoModelo: '2.0.0' })),
    })
    await screen.findByRole('button', { name: 'Classificar' })
    await escolher(usuario, 5, 5, 5)
    const form = screen.getByRole('button', { name: 'Classificar' }).closest('form') as HTMLFormElement
    await act(async () => {
      form.requestSubmit()
    })
    await waitFor(() => expect(posts(fetchMock)).toBe(1))
    // Nova submissão substitui a primeira, que já está no servidor.
    await act(async () => {
      form.requestSubmit()
    })
    expect(await screen.findByText('Versão do modelo: 2.0.0')).toBeInTheDocument()
    await act(async () => {
      primeira.resolver(json({ nivel: 'INICIANTE', versaoModelo: '1.0.0' }))
    })
    expect(screen.getByText('Versão do modelo: 2.0.0')).toBeInTheDocument()
    expect(screen.queryByText('Versão do modelo: 1.0.0')).toBeNull()
  })

  it('erro do serviço mostra mensagem e não repete o POST', async () => {
    const { usuario, fetchMock } = abrir({ 'POST /api/ia/classificacoes': () => problema(503, 'IA_INDISPONIVEL') })
    await screen.findByRole('button', { name: 'Classificar' })
    await escolher(usuario, 1, 1, 1)
    await usuario.click(screen.getByRole('button', { name: 'Classificar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('O serviço de IA está indisponível no momento.')
    expect(posts(fetchMock)).toBe(1)
  })

  it('resposta fora do contrato é tratada como erro', async () => {
    const { usuario } = abrir({ 'POST /api/ia/classificacoes': () => json({ nivel: 'ESPECIALISTA', versaoModelo: '1.0.0' }) })
    await screen.findByRole('button', { name: 'Classificar' })
    await escolher(usuario, 1, 1, 1)
    await usuario.click(screen.getByRole('button', { name: 'Classificar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('resposta inesperada')
  })

  it('CONSENTIMENTO_IA_NECESSARIO bloqueia na hora, mesmo com o cache dizendo autorizado', async () => {
    let consentimento: unknown = AUTORIZADO
    const releitura = adiado<Response>()
    let leituras = 0
    const { usuario, fetchMock } = abrir({
      'GET /api/me/consentimento': () => (++leituras === 1 ? json(consentimento) : releitura.promessa),
      'POST /api/ia/classificacoes': () => {
        consentimento = { autorizado: false, decididoEm: '2026-11-27T19:00:00Z' }
        return problema(403, 'CONSENTIMENTO_IA_NECESSARIO')
      },
    })
    await screen.findByRole('button', { name: 'Classificar' })
    await escolher(usuario, 3, 3, 3)
    await usuario.click(screen.getByRole('button', { name: 'Classificar' }))

    // Antes da nova leitura terminar, o formulário já não está disponível.
    expect(await screen.findByText('Verificando sua autorização para o uso da IA…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Classificar' })).toBeNull()

    await act(async () => {
      releitura.resolver(json(consentimento))
    })
    expect(await screen.findByText('O servidor não encontrou uma autorização válida para o uso da IA.', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Revisar consentimento' })).toBeInTheDocument()
    await waitFor(() => expect(posts(fetchMock)).toBe(1))
  })
})
