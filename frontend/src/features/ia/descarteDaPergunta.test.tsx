import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppRotas } from '@/app/AppRotas'
import { criarQueryClient } from '@/app/queryClient'
import { ProvedorTema } from '@/components/tema/ProvedorTema'
import { AuthContext, type EstadoAuth, type ValorAuth } from '@/features/auth/contexto'
import { lerIdentidade } from '@/features/auth/identidade'
import { criarSessaoApi } from '@/lib/api/cliente'
import { criarFetch, json, ME, rotear } from '@/test/app'

// Respostas simuladas existem somente nestes testes.

// A última pergunta enviada fica na jornada em memória; precisa ser descartada com ela.

const PERGUNTA = 'Pergunta que deve ser descartada'

afterEach(() => {
  vi.unstubAllGlobals()
})

const autenticado = (nomeUsuario: string, geracao: number): EstadoAuth => ({
  status: 'autenticado',
  identidade: lerIdentidade({ ...ME.COLABORADOR_INDIVIDUAL, nomeUsuario }),
  tipoConta: 'COLABORADOR_INDIVIDUAL',
  api: criarSessaoApi(),
  geracao,
})

/** Envia uma pergunta cuja resposta nunca chega: é o caso em que ela precisa sobreviver à navegação. */
async function enviarPergunta() {
  const fetchMock = criarFetch()
  let autorizado = true
  rotear(fetchMock, {
    'GET /api/me/consentimento': () => json({ autorizado, decididoEm: '2026-11-27T18:00:00Z' }),
    'POST /api/ia/orientacoes': () => new Promise<Response>(() => {}),
  })
  const queryClient = criarQueryClient()
  const usuario = userEvent.setup()
  const arvore = (estado: EstadoAuth) => {
    const valor: ValorAuth = { estado, entrar: vi.fn(), sair: vi.fn(), continuar: vi.fn() }
    return (
      <ProvedorTema>
        <QueryClientProvider client={queryClient}>
          <AuthContext value={valor}>
            <MemoryRouter initialEntries={['/competencias']}>
              <AppRotas />
            </MemoryRouter>
          </AuthContext>
        </QueryClientProvider>
      </ProvedorTema>
    )
  }
  const { rerender } = render(arvore(autenticado('ana', 1)))
  const ir = (nome: string) => usuario.click(within(screen.getByRole('complementary')).getByRole('link', { name: nome }))
  await screen.findByRole('button', { name: 'Classificar' })
  for (const grupo of ['Lógica', 'Comunicação', 'Tecnologia']) {
    await usuario.click(within(screen.getByRole('group', { name: grupo })).getByRole('radio', { name: '3' }))
  }
  await ir('Orientador Evolia')
  await usuario.type(await screen.findByRole('textbox', { name: 'Sua pergunta' }), `${PERGUNTA}{Enter}`)
  expect(await screen.findByText(PERGUNTA, { selector: 'p' })).toBeInTheDocument()
  return {
    usuario,
    ir,
    trocarEstado: (estado: EstadoAuth) => rerender(arvore(estado)),
    negarAutorizacao: () => {
      autorizado = false
    },
    autorizarDeNovo: () => {
      autorizado = true
    },
  }
}

const voltarAAba = () => act(async () => void fireEvent(document, new Event('visibilitychange', { bubbles: true })))
const semRastro = () => expect(document.body.textContent).not.toContain(PERGUNTA)

describe('descarte da pergunta enviada', () => {
  it('troca de identidade ou sessão substituída (nova geração)', async () => {
    const { trocarEstado } = await enviarPergunta()
    trocarEstado(autenticado('bruno', 2))
    await screen.findByText('Faça a avaliação primeiro')
    semRastro()
  })

  it.each(['logout', 'sessao-substituida'] as const)('sessão encerrada por %s e novo login', async (motivo) => {
    const { trocarEstado } = await enviarPergunta()
    trocarEstado({ status: 'anonimo', motivo })
    semRastro()
    trocarEstado(autenticado('ana', 2))
    await screen.findByRole('heading', { level: 1 })
    semRastro()
  })

  it('alteração das notas', async () => {
    const { usuario, ir } = await enviarPergunta()
    await ir('Minhas competências')
    await usuario.click(within(await screen.findByRole('group', { name: 'Lógica' })).getByRole('radio', { name: '5' }))
    await ir('Orientador Evolia')
    await screen.findByRole('textbox', { name: 'Sua pergunta' })
    semRastro()
    expect(screen.getByRole('textbox', { name: 'Sua pergunta' })).toHaveValue('')
  })

  it('revogação do consentimento, mesmo autorizando de novo', async () => {
    const { negarAutorizacao, autorizarDeNovo } = await enviarPergunta()
    negarAutorizacao()
    await voltarAAba()
    await screen.findByText('Resultados descartados')
    semRastro()
    autorizarDeNovo()
    await voltarAAba()
    await screen.findByText('Faça a avaliação primeiro')
    semRastro()
  })
})
