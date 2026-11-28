import { focusManager } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { chamadas, json, problema, renderizarAutenticado } from '@/test/app'
import { INTERVALO_POLLING_MS } from './api'
import PaginaTreinamentos from './PaginaTreinamentos'

// Respostas simuladas existem somente nestes testes.

const base = { solicitadoPor: 'admin', criadoEm: '2026-11-27T16:00:00.123456Z', atualizadoEm: '2026-11-27T16:00:00.123456Z' }
const PENDENTE = { id: 2, status: 'PENDENTE', versaoModelo: null, mensagem: null, ...base }
const CONCLUIDA = { id: 1, status: 'CONCLUIDO', versaoModelo: '1.0.0', mensagem: 'Modelo treinado com 120 exemplos.', ...base }
const FALHOU = { id: 3, status: 'FALHOU', versaoModelo: null, mensagem: 'Falha ao publicar na fila.', ...base }

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  focusManager.setFocused(undefined)
})

const listas = (fetchMock: Parameters<typeof chamadas>[0]) => chamadas(fetchMock).filter((c) => c === 'GET /api/treinamentos').length

// Referência real, capturada antes dos fake timers, para deixar as respostas simuladas terminarem.
// Com fake timers, estes testes medem o agendamento (contagem de buscas e estado do cache).
// A atualização visual do polling é verificada com timers reais em "listagem e solicitação".
const setTimeoutReal = globalThis.setTimeout

/** Avança o relógio falso e dá alguns milissegundos reais para as respostas simuladas. */
async function avancar(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
    for (let i = 0; i < 3; i++) {
      await new Promise((resolver) => setTimeoutReal(resolver, 5))
      await vi.advanceTimersByTimeAsync(0)
    }
  })
}

describe('polling', () => {
  function montar(respostas: () => unknown[]) {
    // Só os timers usados pelo TanStack Query e pelo cliente HTTP; setImmediate continua real.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const app = renderizarAutenticado('ADMIN', '/admin/treinamentos', { 'GET /api/treinamentos': () => json(respostas()) }, <PaginaTreinamentos />)
    return app
  }

  it('atualiza a cada intervalo enquanto houver pendente e para quando todas terminam', async () => {
    let atual: unknown[] = [CONCLUIDA, PENDENTE]
    const { fetchMock, queryClient } = montar(() => atual)
    const dados = () => queryClient.getQueryData<{ status: string }[]>(['sessao', 1, 'treinamentos'])
    await avancar(0)
    expect(listas(fetchMock)).toBe(1)
    expect(screen.getByTestId('indicador-polling')).toBeInTheDocument()

    await avancar(INTERVALO_POLLING_MS)
    expect(listas(fetchMock)).toBe(2)

    atual = [CONCLUIDA, { ...PENDENTE, status: 'CONCLUIDO', versaoModelo: '1.0.1', mensagem: 'ok' }]
    await avancar(INTERVALO_POLLING_MS)
    expect(listas(fetchMock)).toBe(3)
    expect(dados()?.every((s) => s.status !== 'PENDENTE')).toBe(true)

    await avancar(INTERVALO_POLLING_MS * 4)
    expect(listas(fetchMock)).toBe(3)
  })

  it('não faz polling sem pendentes', async () => {
    const { fetchMock } = montar(() => [CONCLUIDA, FALHOU])
    await avancar(0)
    await avancar(INTERVALO_POLLING_MS * 5)
    expect(listas(fetchMock)).toBe(1)
  })

  it('para ao desmontar a tela', async () => {
    const { fetchMock, unmount } = montar(() => [PENDENTE])
    await avancar(0)
    unmount()
    await avancar(INTERVALO_POLLING_MS * 5)
    expect(listas(fetchMock)).toBe(1)
  })

  it('para quando a sessão é encerrada (logout), mesmo com a tela montada', async () => {
    const { fetchMock, api, queryClient } = montar(() => [PENDENTE])
    await avancar(0)
    // Mesma sequência do AuthProvider ao sair: encerra a sessão, cancela e limpa o cache.
    act(() => {
      api.encerrar()
      void queryClient.cancelQueries()
      queryClient.clear()
    })
    await avancar(INTERVALO_POLLING_MS * 5)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('pausa com a aba oculta e retoma ao voltar', async () => {
    const { fetchMock } = montar(() => [PENDENTE])
    await avancar(0)
    act(() => focusManager.setFocused(false))
    await avancar(INTERVALO_POLLING_MS * 3)
    expect(listas(fetchMock)).toBe(1)
    act(() => focusManager.setFocused(true))
    await avancar(INTERVALO_POLLING_MS)
    expect(listas(fetchMock)).toBeGreaterThan(1)
  })
})

describe('listagem e solicitação', () => {
  it('lista da mais recente para a mais antiga, com status em texto', async () => {
    renderizarAutenticado('ADMIN', '/admin/treinamentos', { 'GET /api/treinamentos': () => json([CONCLUIDA, PENDENTE, FALHOU]) })
    const tabela = await screen.findByRole('table')
    const linhas = within(tabela).getAllByRole('row').slice(1)
    expect(linhas.map((l) => within(l).getByRole('rowheader').textContent)).toEqual(['3', '2', '1'])
    expect(within(linhas[0] as HTMLElement).getByText('Falhou')).toBeInTheDocument()
    expect(within(linhas[1] as HTMLElement).getByText('Pendente')).toBeInTheDocument()
    expect(within(linhas[2] as HTMLElement).getByText('Concluído')).toBeInTheDocument()
    expect(within(linhas[2] as HTMLElement).getByText('1.0.0')).toBeInTheDocument()
    expect(within(linhas[1] as HTMLElement).getAllByText('—')).toHaveLength(2)
  })

  it('mostra o indicador de atualização só com pendentes', async () => {
    renderizarAutenticado('ADMIN', '/admin/treinamentos', { 'GET /api/treinamentos': () => json([CONCLUIDA, FALHOU]) })
    await screen.findByRole('table')
    expect(screen.queryByTestId('indicador-polling')).toBeNull()
  })

  it('mostra estado vazio', async () => {
    renderizarAutenticado('ADMIN', '/admin/treinamentos', { 'GET /api/treinamentos': () => json([]) })
    expect(await screen.findByText('Nenhuma solicitação ainda')).toBeInTheDocument()
  })

  it('solicita uma única vez com CSRF e recarrega a lista', async () => {
    let lista: unknown[] = [CONCLUIDA]
    const { usuario, fetchMock } = renderizarAutenticado('ADMIN', '/admin/treinamentos', {
      'GET /api/treinamentos': () => json(lista),
      'POST /api/treinamentos': (init) => {
        expect(init?.body).toBeUndefined()
        lista = [CONCLUIDA, PENDENTE]
        return json(PENDENTE, 202)
      },
    })
    await screen.findByRole('table')
    await usuario.click(screen.getByRole('button', { name: 'Solicitar retreinamento' }))

    expect(await screen.findByText('A solicitação nº 2 foi registrada como pendente.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Pendente')).toBeInTheDocument())
    expect(chamadas(fetchMock).filter((c) => c === 'POST /api/treinamentos')).toHaveLength(1)
    expect(chamadas(fetchMock)).toContain('GET /api/csrf')
  })

  it('503 FILA_INDISPONIVEL: informa, recarrega a lista com a falha e não repete', async () => {
    let lista: unknown[] = []
    const { usuario, fetchMock } = renderizarAutenticado('ADMIN', '/admin/treinamentos', {
      'GET /api/treinamentos': () => json(lista),
      'POST /api/treinamentos': () => {
        lista = [FALHOU]
        return problema(503, 'FILA_INDISPONIVEL')
      },
    })
    await screen.findByText('Nenhuma solicitação ainda')
    await usuario.click(screen.getByRole('button', { name: 'Solicitar retreinamento' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A fila de treinamento está indisponível. A solicitação foi registrada como falha.')
    expect(await screen.findByText('Falhou')).toBeInTheDocument()
    expect(chamadas(fetchMock).filter((c) => c === 'POST /api/treinamentos')).toHaveLength(1)
  })

  it('bloqueia duplo clique durante o envio', async () => {
    let liberar: (r: Response) => void = () => {}
    const { usuario, fetchMock } = renderizarAutenticado('ADMIN', '/admin/treinamentos', {
      'GET /api/treinamentos': () => json([]),
      'POST /api/treinamentos': () => new Promise<Response>((r) => (liberar = r)),
    })
    await screen.findByText('Nenhuma solicitação ainda')
    await usuario.click(screen.getByRole('button', { name: 'Solicitar retreinamento' }))
    const botao = await screen.findByRole('button', { name: 'Solicitando…' })
    expect(botao).toBeDisabled()
    await usuario.click(botao)
    await act(async () => liberar(json(PENDENTE, 202)))
    expect(chamadas(fetchMock).filter((c) => c === 'POST /api/treinamentos')).toHaveLength(1)
  })
})

describe('detalhe', () => {
  it('mostra os dados e campos ainda não informados', async () => {
    renderizarAutenticado('ADMIN', '/admin/treinamentos/2', { 'GET /api/treinamentos/2': () => json(PENDENTE) })
    expect(await screen.findByRole('heading', { level: 1, name: 'Solicitação nº 2' })).toBeInTheDocument()
    expect(screen.getByText('Pendente')).toBeInTheDocument()
    expect(screen.getAllByText('Ainda não informada')).toHaveLength(2)
    expect(screen.getByText(/se atualiza automaticamente/)).toBeInTheDocument()
  })

  it('trata 404 e resposta fora do contrato', async () => {
    renderizarAutenticado('ADMIN', '/admin/treinamentos/9', { 'GET /api/treinamentos/9': () => problema(404, 'SOLICITACAO_NAO_ENCONTRADA') })
    expect(await screen.findByText('Solicitação não encontrada')).toBeInTheDocument()
  })

  it('rejeita status fora do contrato', async () => {
    renderizarAutenticado('ADMIN', '/admin/treinamentos', { 'GET /api/treinamentos': () => json([{ ...PENDENTE, status: 'EM_ANDAMENTO' }]) })
    expect(await screen.findByRole('alert')).toHaveTextContent('resposta inesperada')
  })
})
