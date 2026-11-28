import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate, type NavigateFunction } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarQueryClient } from '@/app/queryClient'
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
  fetchMock.mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify(ME[tipo]), { headers: { 'Content-Type': 'application/json' } })),
  )
  await act(async () => {
    await sonda.auth?.entrar({ nomeUsuario: 'usuario', senha: 'senha-de-teste-1' })
  })
}

function navegar(caminho: string) {
  act(() => {
    void sonda.navegar?.(caminho)
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  sonda.auth = null
  sonda.navegar = null
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RotaProtegida', () => {
  it.each(['/admin', '/consentimento', '/cursos', '/painel'])(
    'redireciona anônimo de %s para /entrar, guardando o caminho',
    (caminho) => {
      renderizar(caminho)
      expect(screen.getByText(`Tela de entrada (de: ${caminho})`)).toBeInTheDocument()
    },
  )

  it('mostra o aviso de verificação durante a autenticação', async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}))
    renderizar('/inicio')
    act(() => {
      void sonda.auth?.entrar({ nomeUsuario: 'usuario', senha: 'senha-de-teste-1' })
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
    renderizar('/inicio')
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
    renderizar('/inicio')
    await entrarComo(tipo)
    navegar(caminho)
    expect(screen.getByRole('alert')).toHaveTextContent('Seu perfil não tem acesso a esta área.')
    expect(sonda.auth?.estado.status).toBe('autenticado')
  })

  it('volta para /entrar depois do logout', async () => {
    renderizar('/inicio')
    await entrarComo('ADMIN')
    navegar('/admin')
    expect(screen.getByText('Área administrativa')).toBeInTheDocument()

    act(() => sonda.auth?.sair())

    expect(screen.queryByText('Área administrativa')).toBeNull()
    expect(screen.getByText('Tela de entrada (de: /admin)')).toBeInTheDocument()
  })
})
