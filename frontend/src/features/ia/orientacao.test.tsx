import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppRotas } from '@/app/AppRotas'
import { criarQueryClient } from '@/app/queryClient'
import { ProvedorTema } from '@/components/tema/ProvedorTema'
import { AuthContext, type ValorAuth } from '@/features/auth/contexto'
import { lerIdentidade } from '@/features/auth/identidade'
import { criarSessaoApi, TEMPOS_LIMITE_MS, type SessaoApi } from '@/lib/api/cliente'
import { chamadas, corpoEnviado, criarFetch, json, ME, problema, renderizarAutenticado, rotear, type RotasSimuladas } from '@/test/app'
import { orientar } from './api'

// Respostas simuladas existem somente nestes testes.

const AUTORIZADO = { autorizado: true, decididoEm: '2026-11-27T18:00:00Z' }
const ORIENTACAO = {
  orientacao: 'A classificação estimada pelo modelo é INTERMEDIARIO. Os documentos consultados recomendam: Fundamentos.',
  cursosRecomendados: ['CURSO-001', 'CURSO-007'],
  fontes: ['curso-001.md'],
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

const posts = (fetchMock: Parameters<typeof chamadas>[0]) => chamadas(fetchMock).filter((c) => c === 'POST /api/ia/orientacoes').length

function abrir(rotas: RotasSimuladas) {
  return renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/competencias', {
    'GET /api/me/consentimento': () => json(AUTORIZADO),
    ...rotas,
  })
}

/** Escolhe as notas na avaliação (sem classificar) e abre a orientação pela navegação. */
async function prepararOrientacao(usuario: ReturnType<typeof abrir>['usuario']) {
  await screen.findByRole('button', { name: 'Classificar' })
  for (const [grupo, nota] of [['Lógica', 2], ['Comunicação', 4], ['Tecnologia', 3]] as const) {
    await usuario.click(within(screen.getByRole('group', { name: grupo })).getByRole('radio', { name: String(nota) }))
  }
  await usuario.click(within(screen.getByRole('complementary')).getByRole('link', { name: 'Orientação' }))
  return screen.findByRole('textbox', { name: 'Sua pergunta' })
}

describe('orientação com IA', () => {
  it('sem notas na sessão, leva à avaliação', async () => {
    renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/orientacao', { 'GET /api/me/consentimento': () => json(AUTORIZADO) })
    expect(await screen.findByText('Faça a avaliação primeiro')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fazer a avaliação' })).toHaveAttribute('href', '/competencias')
  })

  it('valida a pergunta conforme o contrato e conta code points', async () => {
    const { usuario, fetchMock } = abrir({})
    const campo = await prepararOrientacao(usuario)

    await usuario.click(screen.getByRole('button', { name: 'Pedir orientação' }))
    expect(await screen.findByText('Escreva sua pergunta.')).toBeInTheDocument()

    fireEvent.change(campo, { target: { value: '     ' } })
    await usuario.click(screen.getByRole('button', { name: 'Pedir orientação' }))
    expect(screen.getByText('Escreva sua pergunta.')).toBeInTheDocument()

    fireEvent.change(campo, { target: { value: '🔒'.repeat(1001) } })
    await usuario.click(screen.getByRole('button', { name: 'Pedir orientação' }))
    expect(await screen.findByText('Use no máximo 1000 caracteres.')).toBeInTheDocument()
    expect(screen.getByText('1001/1000 caracteres')).toBeInTheDocument()

    fireEvent.change(campo, { target: { value: '🔒'.repeat(1000) } })
    expect(screen.getByText('1000/1000 caracteres')).toBeInTheDocument()
    expect(posts(fetchMock)).toBe(0)
  })

  it('envia pergunta aparada e notas aninhadas, e mostra orientação, cursos, fontes e próximos passos', async () => {
    const { usuario, fetchMock } = abrir({
      'POST /api/ia/orientacoes': () => json({ ...ORIENTACAO, proximosPassos: ['Revise a lógica.', 'Pratique comunicação.'] }),
    })
    const campo = await prepararOrientacao(usuario)
    await usuario.type(campo, '  Por onde começo?  ')
    await usuario.click(screen.getByRole('button', { name: 'Pedir orientação' }))

    expect(await screen.findByText(ORIENTACAO.orientacao)).toBeInTheDocument()
    expect(corpoEnviado(fetchMock, 'POST /api/ia/orientacoes')).toEqual({
      pergunta: 'Por onde começo?',
      competencias: { logica: 2, comunicacao: 4, tecnologia: 3 },
    })
    const proximos = screen.getByRole('region', { name: 'Próximos passos sugeridos' })
    expect(within(proximos).getByText('Gerado por IA')).toBeInTheDocument()
    expect(within(proximos).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Revise a lógica.', 'Pratique comunicação.'])
    const cursos = screen.getByRole('region', { name: 'Cursos citados' })
    expect(within(cursos).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['CURSO-001', 'CURSO-007'])
    expect(within(cursos).queryAllByRole('link')).toHaveLength(0)
    expect(within(screen.getByRole('region', { name: 'Fontes consultadas' })).getByText('curso-001.md')).toBeInTheDocument()
    expect(posts(fetchMock)).toBe(1)
  })

  it('sem proximosPassos é resposta válida: nota neutra, sem erro nem selo de IA', async () => {
    const { usuario } = abrir({ 'POST /api/ia/orientacoes': () => json(ORIENTACAO) })
    const campo = await prepararOrientacao(usuario)
    await usuario.type(campo, 'Como evoluir?')
    await usuario.click(screen.getByRole('button', { name: 'Pedir orientação' }))

    const proximos = await screen.findByRole('region', { name: 'Próximos passos sugeridos' })
    expect(proximos).toHaveTextContent('Próximos passos complementares não estão disponíveis agora.')
    expect(within(proximos).queryByText('Gerado por IA')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.each([
    ['vazio', []],
    ['com quatro itens', ['a', 'b', 'c', 'd']],
  ])('proximosPassos %s é tratado como resposta inválida', async (_caso, passos) => {
    const { usuario } = abrir({ 'POST /api/ia/orientacoes': () => json({ ...ORIENTACAO, proximosPassos: passos }) })
    const campo = await prepararOrientacao(usuario)
    await usuario.type(campo, 'Como evoluir?')
    await usuario.click(screen.getByRole('button', { name: 'Pedir orientação' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('resposta inesperada')
  })

  it('não interpreta HTML recebido da IA', async () => {
    const html = '<img src="x" onerror="alert(1)"><b>importante</b>'
    const { usuario, container } = abrir({
      'POST /api/ia/orientacoes': () => json({ orientacao: html, cursosRecomendados: ['<i>x</i>'], fontes: [html], proximosPassos: [html] }),
    })
    const campo = await prepararOrientacao(usuario)
    await usuario.type(campo, 'Teste')
    await usuario.click(screen.getByRole('button', { name: 'Pedir orientação' }))
    expect(await screen.findByText(html, { selector: 'p' })).toBeInTheDocument()
    expect(container.querySelector('img, b, i, script')).toBeNull()
  })

  it('mostra o processamento (até 90 s) e o cancelamento interrompe só a espera no frontend', async () => {
    const resposta = adiado<Response>()
    const { usuario, fetchMock } = abrir({ 'POST /api/ia/orientacoes': () => resposta.promessa })
    const campo = await prepararOrientacao(usuario)
    await usuario.type(campo, 'Pergunta longa')
    await usuario.click(screen.getByRole('button', { name: 'Pedir orientação' }))

    const status = await screen.findByText('A IA está preparando sua orientação.')
    expect(status.closest('[role="status"]')).toHaveTextContent('Isso pode levar até 90 segundos.')
    expect(screen.getByRole('button', { name: 'Pedir orientação' })).toBeDisabled()
    const sinal = fetchMock.mock.calls.find(([url]) => url === '/api/ia/orientacoes')?.[1]?.signal

    await usuario.click(screen.getByRole('button', { name: 'Cancelar espera' }))
    expect(sinal?.aborted).toBe(true)
    expect(screen.getByText(/O processamento pode continuar no servidor/)).toBeInTheDocument()

    await act(async () => {
      resposta.resolver(json(ORIENTACAO))
    })
    expect(screen.queryByText(ORIENTACAO.orientacao)).toBeNull()
  })

  it('erro do serviço mostra mensagem e não repete o POST', async () => {
    const { usuario, fetchMock } = abrir({ 'POST /api/ia/orientacoes': () => problema(504, 'IA_TEMPO_LIMITE') })
    const campo = await prepararOrientacao(usuario)
    await usuario.type(campo, 'Pergunta')
    await usuario.click(screen.getByRole('button', { name: 'Pedir orientação' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('A IA demorou mais que o esperado.')
    expect(posts(fetchMock)).toBe(1)
  })

  it('usa o prazo de orientação do cliente (90 s) e o corpo exato', async () => {
    const enviar = vi.fn().mockResolvedValue(ORIENTACAO)
    const api = { enviar } as unknown as SessaoApi
    const controle = new AbortController()
    await orientar(api, 'Pergunta', { logica: 1, comunicacao: 2, tecnologia: 3 }, controle.signal)
    expect(enviar).toHaveBeenCalledWith(
      '/api/ia/orientacoes',
      { pergunta: 'Pergunta', competencias: { logica: 1, comunicacao: 2, tecnologia: 3 } },
      expect.any(Function),
      { signal: controle.signal, tempoLimiteMs: TEMPOS_LIMITE_MS.orientacao },
    )
    expect(TEMPOS_LIMITE_MS.orientacao).toBe(90_000)
  })
})

describe('revogação e sessão', () => {
  it('bloqueia a IA ao voltar à aba, cancela a orientação após negativa e ignora a resposta tardia', async () => {
    const releitura = adiado<Response>()
    const orientacao = adiado<Response>()
    let leituras = 0
    let sinal: AbortSignal | null | undefined
    const { usuario, fetchMock } = abrir({
      'GET /api/me/consentimento': () => (++leituras === 1 ? json(AUTORIZADO) : releitura.promessa),
      'POST /api/ia/orientacoes': (init) => {
        sinal = init?.signal
        return orientacao.promessa
      },
    })
    await usuario.type(await prepararOrientacao(usuario), 'Pergunta fictícia')
    await usuario.click(screen.getByRole('button', { name: 'Pedir orientação' }))
    await screen.findByText('A IA está preparando sua orientação.')
    expect(sinal?.aborted).toBe(false)

    fireEvent(document, new Event('visibilitychange', { bubbles: true }))
    await screen.findByText('Verificando sua autorização para o uso da IA…')
    expect(screen.queryByLabelText('Sua pergunta')).toBeNull()

    await act(async () => {
      releitura.resolver(json({ autorizado: false, decididoEm: '2026-11-27T19:00:00Z' }))
    })
    expect(await screen.findByText('Resultados descartados')).toBeInTheDocument()
    expect(sinal?.aborted).toBe(true)
    await act(async () => {
      orientacao.resolver(json(ORIENTACAO))
    })
    expect(screen.queryByText(ORIENTACAO.orientacao)).toBeNull()
    expect(posts(fetchMock)).toBe(1)
  })

  it('revogar com orientação em andamento aborta a espera antes do PUT e descarta a jornada', async () => {
    let consentimento: unknown = AUTORIZADO
    const orientacao = adiado<Response>()
    let abortadaAntesDoPut: boolean | undefined
    const { usuario, fetchMock } = abrir({
      'GET /api/me/consentimento': () => json(consentimento),
      'POST /api/ia/orientacoes': () => orientacao.promessa,
      'PUT /api/me/consentimento': () => {
        abortadaAntesDoPut = fetchMock.mock.calls.find(([url]) => url === '/api/ia/orientacoes')?.[1]?.signal?.aborted
        consentimento = { autorizado: false, decididoEm: '2026-11-27T19:00:00Z' }
        return json(consentimento)
      },
    })
    const campo = await prepararOrientacao(usuario)
    await usuario.type(campo, 'Pergunta')
    await usuario.click(screen.getByRole('button', { name: 'Pedir orientação' }))
    await screen.findByText('A IA está preparando sua orientação.')

    await usuario.click(within(screen.getByRole('complementary')).getByRole('link', { name: 'Consentimento' }))
    await usuario.click(await screen.findByRole('button', { name: 'Revogar autorização' }))
    await usuario.click(screen.getByRole('button', { name: 'Confirmar revogação' }))

    expect(await screen.findByText('Autorização revogada')).toBeInTheDocument()
    expect(abortadaAntesDoPut).toBe(true)
    await act(async () => {
      orientacao.resolver(json(ORIENTACAO))
    })

    await usuario.click(within(screen.getByRole('complementary')).getByRole('link', { name: 'Orientação' }))
    expect(await screen.findByText('Autorização necessária')).toBeInTheDocument()
    expect(screen.queryByText(ORIENTACAO.orientacao)).toBeNull()

    // A jornada foi apagada: mesmo autorizando de novo, não há notas nem resultados restaurados.
    await usuario.click(within(screen.getByRole('complementary')).getByRole('link', { name: 'Competências' }))
    expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0)
  })

  it('troca de sessão (nova geração) descarta notas e resultados', async () => {
    const fetchMock = criarFetch()
    rotear(fetchMock, { 'GET /api/me/consentimento': () => json(AUTORIZADO), 'POST /api/ia/orientacoes': () => json(ORIENTACAO) })
    const queryClient = criarQueryClient()
    const usuario = userEvent.setup()
    const valor = (geracao: number): ValorAuth => ({
      estado: {
        status: 'autenticado',
        identidade: lerIdentidade(ME.COLABORADOR_INDIVIDUAL),
        tipoConta: 'COLABORADOR_INDIVIDUAL',
        api: criarSessaoApi({ nomeUsuario: 'ana', senha: 'senha-de-teste-1' }),
        geracao,
      },
      entrar: vi.fn(),
      sair: vi.fn(),
    })
    const arvore = (v: ValorAuth) => (
      <ProvedorTema>
        <QueryClientProvider client={queryClient}>
          <AuthContext value={v}>
            <MemoryRouter initialEntries={['/competencias']}>
              <AppRotas />
            </MemoryRouter>
          </AuthContext>
        </QueryClientProvider>
      </ProvedorTema>
    )
    const { rerender } = render(arvore(valor(1)))
    const campo = await prepararOrientacao(usuario)
    await usuario.type(campo, 'Pergunta')
    await usuario.click(screen.getByRole('button', { name: 'Pedir orientação' }))
    expect(await screen.findByText(ORIENTACAO.orientacao)).toBeInTheDocument()

    rerender(arvore(valor(2)))

    expect(screen.queryByText(ORIENTACAO.orientacao)).toBeNull()
    expect(await screen.findByText('Faça a avaliação primeiro')).toBeInTheDocument()
  })

  it('a releitura de um usuário não autoriza a jornada de outro usuário', async () => {
    const anterior = adiado<Response>()
    const fetchMock = criarFetch()
    const authAna = 'Basic ' + btoa('ana:senha-de-teste-1')
    const authBruno = 'Basic ' + btoa('bruno:senha-de-teste-2')
    let leiturasAna = 0
    rotear(fetchMock, {
      'GET /api/me/consentimento': (init) => {
        const cabecalho = new Headers(init?.headers).get('Authorization')
        if (cabecalho === authAna) return ++leiturasAna === 1 ? json(AUTORIZADO) : anterior.promessa
        expect(cabecalho).toBe(authBruno)
        return json({ autorizado: false, decididoEm: null })
      },
    })
    const queryClient = criarQueryClient()
    const valor = (nomeUsuario: string, senha: string, geracao: number): ValorAuth => ({
      estado: {
        status: 'autenticado',
        identidade: lerIdentidade({ nomeUsuario, perfil: 'COLABORADOR', colaboradorId: geracao }),
        tipoConta: 'COLABORADOR_INDIVIDUAL',
        api: criarSessaoApi({ nomeUsuario, senha }),
        geracao,
      },
      entrar: vi.fn(),
      sair: vi.fn(),
    })
    const arvore = (v: ValorAuth) => (
      <ProvedorTema>
        <QueryClientProvider client={queryClient}>
          <AuthContext value={v}>
            <MemoryRouter initialEntries={['/orientacao']}>
              <AppRotas />
            </MemoryRouter>
          </AuthContext>
        </QueryClientProvider>
      </ProvedorTema>
    )
    const { rerender } = render(arvore(valor('ana', 'senha-de-teste-1', 1)))
    await screen.findByText('Faça a avaliação primeiro')
    fireEvent(document, new Event('visibilitychange', { bubbles: true }))
    await screen.findByText('Verificando sua autorização para o uso da IA…')

    rerender(arvore(valor('bruno', 'senha-de-teste-2', 2)))
    expect(await screen.findByRole('heading', { name: 'Autorização necessária' })).toBeInTheDocument()
    await act(async () => {
      anterior.resolver(json(AUTORIZADO))
    })
    expect(screen.getByRole('heading', { name: 'Autorização necessária' })).toBeInTheDocument()
    expect(screen.queryByText('Faça a avaliação primeiro')).toBeNull()
    expect(posts(fetchMock)).toBe(0)
  })

  it('não persiste notas, perguntas ou respostas no navegador', async () => {
    const gravacoes = vi.spyOn(Storage.prototype, 'setItem')
    const { usuario } = abrir({ 'POST /api/ia/orientacoes': () => json(ORIENTACAO) })
    const campo = await prepararOrientacao(usuario)
    await usuario.type(campo, 'Pergunta privada')
    await usuario.click(screen.getByRole('button', { name: 'Pedir orientação' }))
    await screen.findByText(ORIENTACAO.orientacao)
    expect(gravacoes).not.toHaveBeenCalled()
    expect(sessionStorage.length).toBe(0)
  })
})
