import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate, type NavigateFunction } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarQueryClient } from '@/app/queryClient'
import { servidorSimulado } from '@/test/servidor'
import { AuthProvider } from './AuthProvider'
import { useAuth, type ValorAuth } from './contexto'
import { RotaProtegida } from './RotaProtegida'

// Respostas simuladas existem somente nestes testes.

const ME = {
  ADMIN: { nomeUsuario: 'admin', perfil: 'ADMIN' },
  COLABORADOR_INDIVIDUAL: { nomeUsuario: 'ana', perfil: 'COLABORADOR', colaboradorId: 7 },
  COLABORADOR_DEMONSTRACAO: { nomeUsuario: 'colab.demo', perfil: 'COLABORADOR' },
} as const

const fetchMock = vi.fn<typeof fetch>()
let servidor: ReturnType<typeof servidorSimulado>
const sonda: { auth: ValorAuth | null; navegar: NavigateFunction | null } = { auth: null, navegar: null }

function Sonda() {
  const auth = useAuth()
  const navegar = useNavigate()
  useEffect(() => {
    sonda.auth = auth
    sonda.navegar = navegar
  })
  return null
}

function Entrar() {
  const { state } = useLocation()
  const de = (state as { de?: unknown } | null)?.de
  return <p>Tela de entrada (de: {typeof de === 'string' ? de : 'nenhum'})</p>
}

/** Renderiza e espera a consulta de restauração terminar. */
async function abrir(caminhoInicial: string) {
  renderizar(caminhoInicial)
  await waitFor(() => expect(sonda.auth?.estado.status).toBe('anonimo'))
}

function renderizar(caminhoInicial: string) {
  render(
    <QueryClientProvider client={criarQueryClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={[caminhoInicial]}>
          <Sonda />
          <Routes>
            <Route path="/inicio" element={<p>Início público</p>} />
            <Route path="/entrar" element={<Entrar />} />
            <Route
              path="/admin"
              element={
                <RotaProtegida permitir={['ADMIN']}>
                  <p>Área administrativa</p>
                </RotaProtegida>
              }
            />
            <Route
              path="/consentimento"
              element={
                <RotaProtegida permitir={['COLABORADOR_INDIVIDUAL']}>
                  <p>Consentimento</p>
                </RotaProtegida>
              }
            />
            <Route
              path="/cursos"
              element={
                <RotaProtegida permitir={['ADMIN', 'COLABORADOR_INDIVIDUAL', 'COLABORADOR_DEMONSTRACAO']}>
                  <p>Catálogo</p>
                </RotaProtegida>
              }
            />
            <Route element={<RotaProtegida />}>
              <Route path="/painel" element={<p>Painel</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

async function entrarComo(tipo: keyof typeof ME) {
  await act(async () => {
    await sonda.auth?.entrar({ nomeUsuario: ME[tipo].nomeUsuario, senha: 'senha-de-teste-1' })
  })
}

function navegar(caminho: string) {
  act(() => {
    void sonda.navegar?.(caminho)
  })
}

beforeEach(() => {
  localStorage.clear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  servidor = servidorSimulado(
    fetchMock,
    Object.fromEntries(Object.values(ME).map((me) => [me.nomeUsuario, { me: { ...me }, senha: 'senha-de-teste-1' }])),
  )
  sonda.auth = null
  sonda.navegar = null
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RotaProtegida', () => {
  it('não decide o acesso enquanto verifica a sessão', () => {
    servidor.interceptar('GET /api/me', () => new Promise<Response>(() => {}))
    renderizar('/admin')
    expect(screen.getByRole('status')).toHaveTextContent('Verificando acesso…')
    expect(screen.queryByText(/Tela de entrada/)).toBeNull()
  })

  it.each(['/admin', '/consentimento', '/cursos', '/painel'])(
    'redireciona anônimo de %s para /entrar, guardando o caminho',
    async (caminho) => {
      await abrir(caminho)
      expect(screen.getByText(`Tela de entrada (de: ${caminho})`)).toBeInTheDocument()
    },
  )

  it('mostra o aviso de verificação durante a autenticação', async () => {
    await abrir('/inicio')
    servidor.interceptar('GET /api/me', () => new Promise<Response>(() => {}))
    act(() => {
      void sonda.auth?.entrar({ nomeUsuario: 'admin', senha: 'senha-de-teste-1' })
    })
    navegar('/admin')
    expect(screen.getByRole('status')).toHaveTextContent('Verificando acesso…')
  })

  it.each([
    ['ADMIN', '/admin', 'Área administrativa'],
    ['ADMIN', '/cursos', 'Catálogo'],
    ['ADMIN', '/painel', 'Painel'],
    ['COLABORADOR_INDIVIDUAL', '/consentimento', 'Consentimento'],
    ['COLABORADOR_INDIVIDUAL', '/cursos', 'Catálogo'],
    ['COLABORADOR_DEMONSTRACAO', '/cursos', 'Catálogo'],
    ['COLABORADOR_DEMONSTRACAO', '/painel', 'Painel'],
  ] as const)('%s acessa %s', async (tipo, caminho, conteudo) => {
    await abrir('/inicio')
    await entrarComo(tipo)
    navegar(caminho)
    expect(screen.getByText(conteudo)).toBeInTheDocument()
  })

  it.each([
    ['ADMIN', '/consentimento'],
    ['COLABORADOR_INDIVIDUAL', '/admin'],
    ['COLABORADOR_DEMONSTRACAO', '/admin'],
    ['COLABORADOR_DEMONSTRACAO', '/consentimento'],
  ] as const)('%s é negado em %s sem encerrar a sessão', async (tipo, caminho) => {
    await abrir('/inicio')
    await entrarComo(tipo)
    navegar(caminho)
    expect(screen.getByRole('alert')).toHaveTextContent('Seu perfil não tem acesso a esta área.')
    expect(sonda.auth?.estado.status).toBe('autenticado')
  })

  it('volta para /entrar depois do logout', async () => {
    await abrir('/inicio')
    await entrarComo('ADMIN')
    navegar('/admin')
    expect(screen.getByText('Área administrativa')).toBeInTheDocument()

    act(() => sonda.auth?.sair())

    expect(screen.queryByText('Área administrativa')).toBeNull()
    await waitFor(() => expect(sonda.auth?.estado.status).toBe('anonimo'))
    expect(screen.getByText('Tela de entrada (de: /admin)')).toBeInTheDocument()
  })
})
