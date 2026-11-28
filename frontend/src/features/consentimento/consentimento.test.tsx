import { act, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { chamadas, corpoEnviado, json, problema, renderizarAutenticado, TOKEN_CSRF } from '@/test/app'

// Respostas simuladas existem somente nestes testes.

const NAO_DECIDIDO = { autorizado: false, decididoEm: null }
const AUTORIZADO = { autorizado: true, decididoEm: '2026-11-27T18:00:00.123456Z' }
const REVOGADO = { autorizado: false, decididoEm: '2026-11-27T18:05:00.000001Z' }

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

const gets = (fetchMock: Parameters<typeof chamadas>[0]) => chamadas(fetchMock).filter((c) => c === 'GET /api/me/consentimento').length
const puts = (fetchMock: Parameters<typeof chamadas>[0]) => chamadas(fetchMock).filter((c) => c === 'PUT /api/me/consentimento').length

describe('consentimento', () => {
  it('mostra o estado inicial real e nunca autoriza sem ação explícita', async () => {
    const { fetchMock } = renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/consentimento', {
      'GET /api/me/consentimento': () => json(NAO_DECIDIDO),
    })
    expect(await screen.findByText('Não autorizado')).toBeInTheDocument()
    expect(screen.getByText('Você ainda não registrou uma decisão.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Autorizar uso da IA' })).toBeEnabled()
    expect(screen.getByText('O catálogo de cursos continua disponível sem autorização.')).toBeInTheDocument()
    expect(puts(fetchMock)).toBe(0)
  })

  it('autoriza com o corpo exato e mostra o estado confirmado pelo servidor', async () => {
    let atual: unknown = NAO_DECIDIDO
    const { usuario, fetchMock } = renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/consentimento', {
      'GET /api/me/consentimento': () => json(atual),
      'PUT /api/me/consentimento': () => {
        atual = AUTORIZADO
        return json(AUTORIZADO)
      },
    })
    await usuario.click(await screen.findByRole('button', { name: 'Autorizar uso da IA' }))

    expect(await screen.findByText('Uso da IA autorizado')).toBeInTheDocument()
    expect(await screen.findByText('Autorizado')).toBeInTheDocument()
    expect(screen.getByText(/^Autorização registrada em /)).toBeInTheDocument()
    expect(corpoEnviado(fetchMock, 'PUT /api/me/consentimento')).toEqual({ autorizado: true })
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(new Headers(put?.[1]?.headers).get('X-XSRF-TOKEN')).toBe(TOKEN_CSRF)
    expect(puts(fetchMock)).toBe(1)
    expect(gets(fetchMock)).toBe(2)
  })

  it('revogação pede confirmação e só aparece como revogada após o servidor confirmar', async () => {
    let atual: unknown = AUTORIZADO
    const resposta = adiado<Response>()
    const { usuario, fetchMock } = renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/consentimento', {
      'GET /api/me/consentimento': () => json(atual),
      'PUT /api/me/consentimento': () => resposta.promessa,
    })
    await usuario.click(await screen.findByRole('button', { name: 'Revogar autorização' }))
    expect(screen.getByText('Revogar a autorização?')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(puts(fetchMock)).toBe(0)

    await usuario.click(screen.getByRole('button', { name: 'Revogar autorização' }))
    await usuario.click(screen.getByRole('button', { name: 'Confirmar revogação' }))

    // Enquanto o PUT não volta, não há confirmação de revogação.
    expect(await screen.findByText('Enviando sua decisão ao servidor…')).toBeInTheDocument()
    expect(screen.queryByText('Autorização revogada')).toBeNull()
    expect(screen.queryByText('Não autorizado')).toBeNull()

    atual = REVOGADO
    await act(async () => {
      resposta.resolver(json(REVOGADO))
    })
    expect(await screen.findByText('Autorização revogada')).toBeInTheDocument()
    expect(await screen.findByText('Não autorizado')).toBeInTheDocument()
    expect(corpoEnviado(fetchMock, 'PUT /api/me/consentimento')).toEqual({ autorizado: false })
  })

  it('releitura em segundo plano não bloqueia o botão de revogar', async () => {
    const releitura = adiado<Response>()
    let leituras = 0
    const { usuario, queryClient } = renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/consentimento', {
      'GET /api/me/consentimento': () => (++leituras === 1 ? json(AUTORIZADO) : releitura.promessa),
    })
    const botao = await screen.findByRole('button', { name: 'Revogar autorização' })
    act(() => {
      void queryClient.invalidateQueries({ queryKey: ['sessao', 1, 'consentimento'] })
    })
    expect(botao).toBeEnabled()
    await usuario.click(botao)
    expect(screen.getByText('Revogar a autorização?')).toBeInTheDocument()
    await act(async () => {
      releitura.resolver(json(AUTORIZADO))
    })
  })

  it('falha na decisão: mensagem clara, nova consulta do estado real e sem repetir o PUT', async () => {
    const { usuario, fetchMock } = renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/consentimento', {
      'GET /api/me/consentimento': () => json(NAO_DECIDIDO),
      'PUT /api/me/consentimento': () => new Response(null, { status: 503 }),
    })
    await usuario.click(await screen.findByRole('button', { name: 'Autorizar uso da IA' }))

    expect(await screen.findByText('Não foi possível registrar a autorização')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Serviço temporariamente indisponível')
    await waitFor(() => expect(gets(fetchMock)).toBe(2))
    expect(await screen.findByText('Não autorizado')).toBeInTheDocument()
    expect(puts(fetchMock)).toBe(1)
  })

  it('bloqueia o duplo envio da decisão', async () => {
    const resposta = adiado<Response>()
    const { usuario, fetchMock } = renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/consentimento', {
      'GET /api/me/consentimento': () => json(NAO_DECIDIDO),
      'PUT /api/me/consentimento': () => resposta.promessa,
    })
    const botao = await screen.findByRole('button', { name: 'Autorizar uso da IA' })
    await usuario.click(botao)
    await usuario.click(botao)
    await act(async () => {
      resposta.resolver(json(AUTORIZADO))
    })
    expect(puts(fetchMock)).toBe(1)
  })

  it('erro ao consultar oferece nova tentativa', async () => {
    let tentativas = 0
    const { usuario } = renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/consentimento', {
      'GET /api/me/consentimento': () => (++tentativas === 1 ? problema(503, 'IA_INDISPONIVEL') : json(NAO_DECIDIDO)),
    })
    await usuario.click(await screen.findByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Não autorizado')).toBeInTheDocument()
  })

  it('trata resposta fora do contrato como erro', async () => {
    renderizarAutenticado('COLABORADOR_INDIVIDUAL', '/consentimento', {
      'GET /api/me/consentimento': () => json({ autorizado: 'sim', decididoEm: null }),
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('resposta inesperada')
  })
})
