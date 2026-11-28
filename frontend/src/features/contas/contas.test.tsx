import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { chamadas, corpoEnviado, json, problema, renderizarAutenticado, TOKEN_CSRF } from '@/test/app'
import { problemaNaSenha } from './api'

// Respostas simuladas existem somente nestes testes.

const COLABORADORES = [
  { id: 7, nome: 'Ana Teste', email: 'ana.teste@example.com', cargo: 'Analista', departamento: 'Educação', criadoEm: '2026-11-26T10:00:00Z' },
  { id: 8, nome: 'Bruno Teste', email: 'bruno.teste@example.com', cargo: 'Analista', departamento: 'Tecnologia', criadoEm: '2026-11-26T11:00:00Z' },
]
const SENHA = 'senha-inicial-çã-123'
const CONTA = { id: 31, nomeUsuario: 'ana.teste', perfil: 'COLABORADOR', colaboradorId: 7, criadoEm: '2026-11-27T15:00:00.000001Z' }

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

const campo = (rotulo: string) => screen.getByLabelText<HTMLInputElement>(rotulo)

async function abrir(caminho = '/admin/contas', rotas: Parameters<typeof renderizarAutenticado>[2] = {}) {
  const app = renderizarAutenticado('ADMIN', caminho, { 'GET /api/colaboradores': () => json(COLABORADORES), ...rotas })
  await screen.findByRole('heading', { name: 'Nova conta individual' })
  return app
}

async function preencher(usuario: ReturnType<typeof renderizarAutenticado>['usuario'], senha = SENHA, confirmacao = senha) {
  await usuario.selectOptions(screen.getByRole('combobox', { name: 'Colaborador' }), '7')
  await usuario.type(campo('Nome de usuário'), 'Ana.Teste')
  await usuario.type(campo('Senha inicial'), senha)
  await usuario.type(campo('Confirmar senha'), confirmacao)
}

describe('regra da senha inicial (ContasIndividuais.senhaValida)', () => {
  it.each([
    ['', 'Informe a senha inicial.'],
    ['a'.repeat(11), 'Use pelo menos 12 caracteres.'],
    [' '.repeat(14), 'A senha não pode ter apenas espaços.'],
    ['ç'.repeat(37), 'Use no máximo 72 bytes. Letras acentuadas e emojis ocupam mais de um byte.'],
    ['abc\u0000defghijkl', 'A senha contém caracteres inválidos.'],
    ['abcdefghijkl\uD800', 'A senha contém caracteres inválidos.'],
  ])('rejeita %j', (senha, mensagem) => {
    expect(problemaNaSenha(senha)).toBe(mensagem)
  })

  it.each(['a'.repeat(12), 'ç'.repeat(36), '🔒'.repeat(12), 'a'.repeat(72), ' senha com espaços '])('aceita %j', (senha) => {
    expect(problemaNaSenha(senha)).toBeNull()
  })
})

describe('criação de conta', () => {
  it('envia exatamente o contrato com CSRF, limpa a senha durante o envio e mostra o resultado sem senha', async () => {
    const resposta = adiado<Response>()
    const { usuario, fetchMock, queryClient } = await abrir('/admin/contas', {
      'POST /api/colaboradores/7/conta': () => resposta.promessa,
    })
    await preencher(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }))

    // Ainda pendente: campos de senha já vazios e botão bloqueado.
    expect(await screen.findByRole('button', { name: 'Criando conta…' })).toBeDisabled()
    expect(campo('Senha inicial').value).toBe('')
    expect(campo('Confirmar senha').value).toBe('')
    expect(corpoEnviado(fetchMock, 'POST /api/colaboradores/7/conta')).toEqual({ nomeUsuario: 'Ana.Teste', senhaInicial: SENHA })
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(new Headers(post?.[1]?.headers).get('X-XSRF-TOKEN')).toBe(TOKEN_CSRF)

    await act(async () => {
      resposta.resolver(json(CONTA, 201))
    })
    const resultado = await screen.findByRole('status')
    expect(within(resultado).getByText('Conta criada')).toBeInTheDocument()
    expect(within(resultado).getByText('ana.teste')).toBeInTheDocument()
    expect(within(resultado).getByText('Ana Teste')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(SENHA)
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
    expect(JSON.stringify(queryClient.getQueryCache().getAll().map((q) => q.state.data))).not.toContain(SENHA)
  })

  it('valida senha, confirmação e nome de usuário sem chamar a API', async () => {
    const { usuario, fetchMock } = await abrir()
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText('Selecione o colaborador.')).toBeInTheDocument()
    expect(screen.getByText('Informe o nome de usuário.')).toBeInTheDocument()
    expect(screen.getByText('Informe a senha inicial.')).toBeInTheDocument()

    await preencher(usuario, 'curta', 'curta')
    await usuario.clear(campo('Nome de usuário'))
    await usuario.type(campo('Nome de usuário'), 'ana:teste')
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText('Use pelo menos 12 caracteres.')).toBeInTheDocument()
    expect(screen.getByText('Use até 64 letras sem acento, números, pontos, hífens ou sublinhados.')).toBeInTheDocument()

    await usuario.clear(campo('Senha inicial'))
    await usuario.clear(campo('Confirmar senha'))
    await usuario.type(campo('Senha inicial'), SENHA)
    await usuario.type(campo('Confirmar senha'), `${SENHA}x`)
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText('As senhas não coincidem.')).toBeInTheDocument()
    expect(chamadas(fetchMock).some((c) => c.startsWith('POST'))).toBe(false)
  })

  it.each([
    ['CONTA_DUPLICADA', 'Colaborador', 'Este colaborador já possui uma conta individual.'],
    ['NOME_USUARIO_INDISPONIVEL', 'Nome de usuário', 'Este nome de usuário não está disponível.'],
  ] as const)('409 %s aparece no campo certo, sem guardar a senha', async (codigo, rotulo, mensagem) => {
    const { usuario } = await abrir('/admin/contas', { 'POST /api/colaboradores/7/conta': () => problema(409, codigo) })
    await preencher(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(await screen.findByText(mensagem)).toBeInTheDocument()
    const controle = screen.getByLabelText(rotulo)
    expect(controle).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(controle).toHaveFocus())
    expect(campo('Senha inicial').value).toBe('')
    expect(document.body.textContent).not.toContain(SENHA)
  })

  it('404 do colaborador mostra mensagem geral e recarrega a lista', async () => {
    const { usuario, fetchMock } = await abrir('/admin/contas', {
      'POST /api/colaboradores/7/conta': () => problema(404, 'COLABORADOR_NAO_ENCONTRADO'),
    })
    await preencher(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Colaborador não encontrado.')
    await waitFor(() => expect(chamadas(fetchMock).filter((c) => c === 'GET /api/colaboradores')).toHaveLength(2))
  })

  it('bloqueia duplo envio', async () => {
    const resposta = adiado<Response>()
    const { usuario, fetchMock } = await abrir('/admin/contas', { 'POST /api/colaboradores/7/conta': () => resposta.promessa })
    await preencher(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }))
    await usuario.click(await screen.findByRole('button', { name: 'Criando conta…' }))
    await act(async () => {
      resposta.resolver(json(CONTA, 201))
    })
    expect(chamadas(fetchMock).filter((c) => c.startsWith('POST'))).toHaveLength(1)
  })

  it('ignora a resposta quando a sessão é encerrada durante o envio', async () => {
    const resposta = adiado<Response>()
    const { usuario, api } = await abrir('/admin/contas', { 'POST /api/colaboradores/7/conta': () => resposta.promessa })
    await preencher(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }))
    await screen.findByRole('button', { name: 'Criando conta…' })

    await act(async () => {
      api.encerrar()
      resposta.resolver(json(CONTA, 201))
    })

    expect(screen.queryByText('Conta criada')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('pré-seleção pela navegação', () => {
  it('seleciona o colaborador indicado e não envia a query string ao backend', async () => {
    const { fetchMock } = await abrir('/admin/contas?colaborador=8')
    expect(screen.getByRole('combobox', { name: 'Colaborador' })).toHaveValue('8')
    expect(chamadas(fetchMock).every((c) => !c.includes('?'))).toBe(true)
  })

  it.each(['0', '-8', '8.0', 'abc', '99', '9007199254740992'])('ignora colaborador=%s', async (valor) => {
    const { fetchMock } = await abrir(`/admin/contas?colaborador=${valor}`)
    expect(screen.getByRole('combobox', { name: 'Colaborador' })).toHaveValue('')
    expect(chamadas(fetchMock)).toEqual(['GET /api/colaboradores'])
  })
})
