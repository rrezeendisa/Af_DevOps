import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProvedorTema } from '@/components/tema/ProvedorTema'
import { criarSessaoApi } from '@/lib/api/cliente'
import { codificarBasic } from '@/lib/api/credenciais'
import { criarFetch, json, ME, preencherLogin, problema, renderizarApp } from '@/test/app'
import { AuthContext, type EstadoAuth, type ValorAuth } from './contexto'
import { PaginaEntrar } from './PaginaEntrar'

// Respostas simuladas existem somente nestes testes.

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

const campoUsuario = () => screen.getByLabelText<HTMLInputElement>('Nome de usuário')
const campoSenha = () => screen.getByLabelText<HTMLInputElement>('Senha')

function adiado<T>() {
  let resolver: (valor: T) => void = () => {}
  const promessa = new Promise<T>((r) => {
    resolver = r
  })
  return { promessa, resolver }
}

function Local() {
  const { pathname } = useLocation()
  return <p data-testid="local">{pathname}</p>
}

/** Renderiza só a tela de entrada com um estado de autenticação controlado. */
function renderizarComEstado(estado: EstadoAuth, state?: unknown) {
  const valor: ValorAuth = { estado, entrar: vi.fn(), sair: vi.fn() }
  render(
    <ProvedorTema>
      <AuthContext value={valor}>
        <MemoryRouter initialEntries={[{ pathname: '/entrar', state }]}>
          <Routes>
            <Route path="/entrar" element={<PaginaEntrar />} />
            <Route path="*" element={<Local />} />
          </Routes>
        </MemoryRouter>
      </AuthContext>
    </ProvedorTema>,
  )
  return valor
}

describe('validação', () => {
  it('exige os dois campos sem chamar a API', async () => {
    const fetchMock = criarFetch()
    const { usuario } = renderizarApp('/entrar')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Informe o nome de usuário.')).toBeInTheDocument()
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument()
    expect(campoUsuario()).toHaveAttribute('aria-invalid', 'true')
    expect(campoUsuario()).toHaveAccessibleDescription('Informe o nome de usuário.')
    expect(campoSenha()).toHaveAccessibleDescription('Informe a senha.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['ana:maria', 'ana silva', 'joão', 'a'.repeat(65)])('rejeita nome de usuário inválido (%j)', async (nome) => {
    const fetchMock = criarFetch()
    const { usuario } = renderizarApp('/entrar')
    await preencherLogin(usuario, nome)
    expect(
      await screen.findByText('Use até 64 letras sem acento, números, pontos, hífens ou sublinhados.'),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('interação', () => {
  it('alterna a visibilidade da senha', async () => {
    criarFetch()
    const { usuario } = renderizarApp('/entrar')
    const alternar = screen.getByRole('button', { name: 'Mostrar senha' })
    expect(campoSenha()).toHaveAttribute('type', 'password')
    expect(alternar).toHaveAttribute('aria-pressed', 'false')
    expect(alternar).toHaveAttribute('aria-controls', 'senha')

    await usuario.click(alternar)
    expect(campoSenha()).toHaveAttribute('type', 'text')
    expect(alternar).toHaveAttribute('aria-pressed', 'true')

    await usuario.click(alternar)
    expect(campoSenha()).toHaveAttribute('type', 'password')
  })

  it('percorre o formulário pelo teclado e envia com Enter', async () => {
    const fetchMock = criarFetch()
    fetchMock.mockResolvedValue(json(ME.ADMIN))
    const { usuario } = renderizarApp('/entrar')

    await usuario.tab()
    expect(screen.getByRole('link', { name: 'Ir para o formulário' })).toHaveFocus()
    await usuario.tab()
    expect(screen.getByRole('button', { name: /^Tema/ })).toHaveFocus()
    await usuario.tab()
    expect(campoUsuario()).toHaveFocus()
    await usuario.keyboard('admin')
    await usuario.tab()
    expect(campoSenha()).toHaveFocus()
    await usuario.keyboard('senha-de-teste-1')
    await usuario.tab()
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveFocus()
    await usuario.tab()
    expect(screen.getByRole('button', { name: 'Entrar' })).toHaveFocus()

    await usuario.click(campoSenha())
    await usuario.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Gestão que transforma.' })).toBeInTheDocument()
    // Um único login (sem retentativa); as demais chamadas são do painel do ADMIN.
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === '/api/me')).toHaveLength(1)
  })

  it('limpa a senha logo após o envio, sem interferir na autenticação', async () => {
    const fetchMock = criarFetch()
    const me = adiado<Response>()
    fetchMock.mockReturnValue(me.promessa)
    const { usuario } = renderizarApp('/entrar')

    await preencherLogin(usuario, 'admin', 'senha-çã€-123')

    // Requisição ainda pendente: senha já limpa, botão em estado de envio.
    expect(campoSenha().value).toBe('')
    expect(campoUsuario().value).toBe('admin')
    const botao = screen.getByRole('button', { name: 'Entrando…' })
    expect(botao).toBeDisabled()
    const autorizacao = new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('Authorization')
    expect(autorizacao).toBe(codificarBasic({ nomeUsuario: 'admin', senha: 'senha-çã€-123' }))

    await act(async () => {
      me.resolver(json(ME.ADMIN))
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'Gestão que transforma.' })).toBeInTheDocument()
  })

  it('não permite duplo envio enquanto autentica', async () => {
    const fetchMock = criarFetch()
    const me = adiado<Response>()
    fetchMock.mockReturnValue(me.promessa)
    const { usuario } = renderizarApp('/entrar')

    await preencherLogin(usuario, 'admin', 'senha-de-teste-1')
    await usuario.type(campoSenha(), 'outra{Enter}')
    await usuario.click(screen.getByRole('button', { name: 'Entrando…' }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => {
      me.resolver(json(ME.ADMIN))
    })
  })
})

describe('resultado do login', () => {
  it('leva ao destino original quando permitido', async () => {
    const fetchMock = criarFetch()
    fetchMock.mockResolvedValue(json(ME.ADMIN))
    const { usuario } = renderizarApp('/admin/treinamentos')
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()

    await preencherLogin(usuario)

    expect(await screen.findByRole('heading', { level: 1, name: 'Treinamentos' })).toBeInTheDocument()
  })

  it('volta ao início quando o destino original não é permitido', async () => {
    const fetchMock = criarFetch()
    fetchMock.mockResolvedValue(json(ME.COLABORADOR_INDIVIDUAL))
    const { usuario } = renderizarApp('/admin/treinamentos')
    await screen.findByRole('heading', { level: 1, name: 'Entrar' })

    await preencherLogin(usuario)

    expect(await screen.findByRole('heading', { level: 1, name: 'Aprender é evoluir.' })).toBeInTheDocument()
    expect(screen.queryByText('Seu perfil não tem acesso a esta área.')).toBeNull()
  })

  it('ignora destino externo vindo do histórico', () => {
    const fetchMock = criarFetch()
    const api = criarSessaoApi({ nomeUsuario: 'admin', senha: 'x' })
    renderizarComEstado(
      { status: 'autenticado', identidade: { nomeUsuario: 'admin', perfil: 'ADMIN' }, tipoConta: 'ADMIN', api, geracao: 1 },
      { de: '//outra.origem/admin' },
    )
    expect(screen.getByTestId('local').textContent).toBe('/')
    expect(fetchMock).not.toHaveBeenCalled()
    api.encerrar()
  })

  it('redireciona quem já está autenticado para o destino permitido', () => {
    criarFetch()
    const api = criarSessaoApi({ nomeUsuario: 'admin', senha: 'x' })
    renderizarComEstado(
      { status: 'autenticado', identidade: { nomeUsuario: 'admin', perfil: 'ADMIN' }, tipoConta: 'ADMIN', api, geracao: 1 },
      { de: '/admin/contas' },
    )
    expect(screen.getByTestId('local').textContent).toBe('/admin/contas')
    api.encerrar()
  })

  it('credenciais inválidas: mensagem, senha limpa e foco na senha', async () => {
    const fetchMock = criarFetch()
    fetchMock.mockResolvedValue(problema(401, 'AUTENTICACAO_NECESSARIA'))
    const { usuario } = renderizarApp('/entrar')

    await preencherLogin(usuario, 'admin', 'senha-errada-1')

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário ou senha incorretos.')
    expect(campoSenha().value).toBe('')
    expect(campoUsuario().value).toBe('admin')
    await waitFor(() => expect(campoSenha()).toHaveFocus())
    expect(screen.queryByText('Sua sessão foi encerrada. Entre novamente.')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['serviço indisponível', () => new Response(null, { status: 503 }), 'Não foi possível conectar à Evolia agora. Tente novamente em instantes.'],
    ['falha de rede', () => Promise.reject(new TypeError('Failed to fetch')), 'Não foi possível conectar à Evolia agora. Tente novamente em instantes.'],
    ['resposta inválida', () => json({ nomeUsuario: 'admin', perfil: 'GESTOR' }), 'Não foi possível concluir a entrada. Tente novamente.'],
  ] as const)('%s: mensagem amigável com foco na mensagem', async (_caso, resposta, texto) => {
    const fetchMock = criarFetch()
    fetchMock.mockImplementation(() => Promise.resolve(resposta()))
    const { usuario } = renderizarApp('/entrar')

    await preencherLogin(usuario)

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(texto)
    await waitFor(() => expect(alerta).toHaveFocus())
    expect(campoSenha().value).toBe('')
  })

  it('mostra aviso de sessão expirada', () => {
    criarFetch()
    renderizarComEstado({ status: 'anonimo', motivo: 'sessao-expirada' })
    expect(screen.getByRole('status')).toHaveTextContent('Sua sessão foi encerrada. Entre novamente.')
  })

  it('mostra aviso após sair e não mostra avisos na primeira visita', async () => {
    const fetchMock = criarFetch()
    fetchMock.mockResolvedValue(json(ME.ADMIN))
    const { usuario } = renderizarApp('/entrar')
    expect(screen.queryByRole('status')).toBeNull()

    await preencherLogin(usuario)
    await screen.findByRole('heading', { level: 1, name: 'Gestão que transforma.' })
    await usuario.click(screen.getByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Você saiu da Evolia.')
    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
  })
})

describe('privacidade', () => {
  it('não persiste credenciais nem dados e mantém só a preferência de tema', async () => {
    const gravacoes = vi.spyOn(Storage.prototype, 'setItem')
    const fetchMock = criarFetch()
    fetchMock.mockResolvedValue(problema(401, 'AUTENTICACAO_NECESSARIA'))
    const { usuario } = renderizarApp('/entrar')

    await preencherLogin(usuario, 'admin', 'senha-secreta-123')
    await screen.findByRole('alert')

    expect(gravacoes).not.toHaveBeenCalled()
    expect(sessionStorage.length).toBe(0)
    expect(Object.keys(localStorage)).toEqual([])
    expect(document.body.textContent).not.toContain('senha-secreta-123')
  })
})
