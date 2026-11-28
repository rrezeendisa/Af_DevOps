import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAVE_TEMA, lerPreferencia } from '@/lib/tema'
import { AlternadorTema } from './AlternadorTema'
import { useTema } from './contexto'
import { ProvedorTema } from './ProvedorTema'

type Ouvinte = (evento: MediaQueryListEvent) => void

/** Simula `prefers-color-scheme` e permite disparar mudanças do sistema. */
function simularSistema(escuro: boolean) {
  const ouvintes = new Set<Ouvinte>()
  const consulta = {
    matches: escuro,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_tipo: string, ouvinte: Ouvinte) => ouvintes.add(ouvinte),
    removeEventListener: (_tipo: string, ouvinte: Ouvinte) => ouvintes.delete(ouvinte),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }
  vi.stubGlobal('matchMedia', () => consulta)
  return {
    mudar(novoEscuro: boolean) {
      consulta.matches = novoEscuro
      for (const ouvinte of ouvintes) ouvinte({ matches: novoEscuro } as MediaQueryListEvent)
    },
    ouvintes,
  }
}

function Sonda() {
  const { preferencia, tema } = useTema()
  return <p data-testid="tema">{`${preferencia}:${tema}`}</p>
}

function renderizar() {
  return render(
    <ProvedorTema>
      <Sonda />
      <AlternadorTema />
    </ProvedorTema>,
  )
}

const raizEscura = () => document.documentElement.classList.contains('dark')

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('tema', () => {
  it('na primeira visita segue o sistema (escuro)', () => {
    simularSistema(true)
    renderizar()
    expect(screen.getByTestId('tema').textContent).toBe('sistema:escuro')
    expect(raizEscura()).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(localStorage.getItem(CHAVE_TEMA)).toBeNull()
  })

  it('na primeira visita segue o sistema (claro)', () => {
    simularSistema(false)
    renderizar()
    expect(screen.getByTestId('tema').textContent).toBe('sistema:claro')
    expect(raizEscura()).toBe(false)
  })

  it('aplica a preferência salva, acima da do sistema', () => {
    simularSistema(false)
    localStorage.setItem(CHAVE_TEMA, 'escuro')
    renderizar()
    expect(screen.getByTestId('tema').textContent).toBe('escuro:escuro')
    expect(raizEscura()).toBe(true)
  })

  it('ignora valor inválido salvo', () => {
    simularSistema(false)
    localStorage.setItem(CHAVE_TEMA, '<script>')
    renderizar()
    expect(screen.getByTestId('tema').textContent).toBe('sistema:claro')
  })

  it('tolera falha do armazenamento', () => {
    simularSistema(true)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(lerPreferencia()).toBe('sistema')
    renderizar()
    expect(screen.getByTestId('tema').textContent).toBe('sistema:escuro')
  })

  it('acompanha a mudança do sistema quando a preferência é "sistema"', () => {
    const sistema = simularSistema(false)
    renderizar()
    act(() => sistema.mudar(true))
    expect(screen.getByTestId('tema').textContent).toBe('sistema:escuro')
    expect(raizEscura()).toBe(true)
  })

  it('alternador é acessível e salva somente a preferência visual', async () => {
    simularSistema(false)
    const gravacoes = vi.spyOn(Storage.prototype, 'setItem')
    const usuario = userEvent.setup()
    renderizar()

    await usuario.click(screen.getByRole('button', { name: 'Tema: Seguir o sistema' }))
    await usuario.click(await screen.findByRole('menuitemradio', { name: 'Escuro' }))

    expect(screen.getByTestId('tema').textContent).toBe('escuro:escuro')
    expect(raizEscura()).toBe(true)
    expect(screen.getByRole('button', { name: 'Tema: Escuro' })).toBeInTheDocument()
    expect(gravacoes.mock.calls).toEqual([[CHAVE_TEMA, 'escuro']])
  })

  it('preferência fixa não muda com o sistema e remove o ouvinte ao desmontar', () => {
    const sistema = simularSistema(false)
    localStorage.setItem(CHAVE_TEMA, 'claro')
    const { unmount } = renderizar()
    act(() => sistema.mudar(true))
    expect(screen.getByTestId('tema').textContent).toBe('claro:claro')
    unmount()
    expect(sistema.ouvintes.size).toBe(0)
  })

  it('não deixa transições ativas depois da troca', () => {
    simularSistema(true)
    renderizar()
    expect(document.documentElement.classList.contains('sem-transicao')).toBe(false)
  })
})
