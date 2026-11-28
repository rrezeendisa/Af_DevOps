import { act, fireEvent, render, screen } from '@testing-library/react'
import { Lock } from 'lucide-react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Revelar } from '@/components/motion/Revelar'
import { CapaArte } from './CapaArte'
import { CapaTematica } from './CapaTematica'
import { Foto } from './Foto'
import { urlDaFoto } from './fotos'
import { IlustracaoComunicacao, IlustracaoLogica, IlustracaoPrivacidade, IlustracaoTecnologia, IlustracaoVazio } from './Ilustracoes'
import { PetalasVivas } from './PetalasVivas'
import { RetratoArte } from './RetratoArte'
import { SeloFlutuante } from './SeloFlutuante'
import { temaDaCategoria, variacaoDe } from './temas'
import { TracoJornada } from './TracoJornada'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('temas de categoria', () => {
  it.each([
    ['Tecnologia', 'tecnologia'],
    ['Desenvolvimento de software', 'tecnologia'],
    ['Segurança da Informação', 'seguranca'],
    ['COMUNICAÇÃO', 'comunicacao'],
    ['Raciocínio lógico', 'logica'],
    ['Teste Evolia', 'generico'],
    ['', 'generico'],
  ] as const)('%j usa o tema %s', (categoria, tema) => {
    expect(temaDaCategoria(categoria)).toBe(tema)
  })

  it('a variação é estável e fica entre 0 e 3', () => {
    expect(variacaoDe('Gestão')).toBe(variacaoDe('gestao'))
    for (const nome of ['a', 'Gestão', 'Finanças', '']) {
      expect([0, 1, 2, 3]).toContain(variacaoDe(nome))
    }
  })
})

describe('fotografias', () => {
  it('prefere AVIF e devolve undefined sem arquivo', () => {
    const arquivos = { '../x/area-logica.webp': '/assets/a.webp', '../x/area-logica.avif': '/assets/a.avif' }
    expect(urlDaFoto('area-logica', arquivos)).toBe('/assets/a.avif')
    expect(urlDaFoto('hero-aprendizado', arquivos)).toBeUndefined()
  })

  it('sem arquivo ou com falha de carregamento mostra o fallback', () => {
    const { rerender } = render(<Foto nome="area-logica" alt="Quadro" fallback={<p>reserva</p>} largura={10} altura={10} src="" />)
    expect(screen.getByText('reserva')).toBeInTheDocument()
    rerender(<Foto key="b" nome="area-logica" alt="Quadro" fallback={<p>reserva</p>} largura={10} altura={10} src="/assets/x.webp" />)
    const imagem = screen.getByRole('img', { name: 'Quadro' })
    expect(imagem).toHaveAttribute('loading', 'lazy')
    expect(imagem).toHaveAttribute('width', '10')
    fireEvent.error(imagem)
    expect(screen.getByText('reserva')).toBeInTheDocument()
  })

  it('a capa temática sem foto usa a ilustração da categoria', () => {
    const { container } = render(<CapaTematica categoria="Comunicação" />)
    expect(container.querySelector('svg[data-tema="comunicacao"]')).not.toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('arte decorativa', () => {
  it('fica oculta para leitores de tela e não usa atributo style nem data: (CSP)', () => {
    const { container } = render(
      <>
        {(['tecnologia', 'seguranca', 'comunicacao', 'logica', 'generico'] as const).map((tema) => (
          <CapaArte key={tema} tema={tema} semente={tema} />
        ))}
        <IlustracaoLogica />
        <IlustracaoComunicacao />
        <IlustracaoTecnologia />
        <IlustracaoPrivacidade />
        <IlustracaoVazio />
        <TracoJornada animar />
        <RetratoArte />
        <PetalasVivas />
      </>,
    )
    for (const svg of container.querySelectorAll('svg')) {
      expect(svg.closest('[aria-hidden="true"]')).not.toBeNull()
    }
    expect(container.querySelector('[style]')).toBeNull()
    expect(container.innerHTML).not.toContain('data:')
  })

  it('selo identifica conteúdo ilustrativo', () => {
    render(<SeloFlutuante icone={Lock} titulo="Autorização" ilustrativo />)
    expect(screen.getByText('Ilustrativo')).toBeInTheDocument()
  })
})

describe('Revelar', () => {
  it('sem IntersectionObserver mostra o conteúdo imediatamente', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(<Revelar>conteúdo</Revelar>)
    expect(screen.getByText('conteúdo')).toHaveAttribute('data-visivel', 'true')
  })

  it('revela ao entrar na tela e desconecta o observador', () => {
    let avisar: (entradas: { isIntersecting: boolean }[]) => void = () => {}
    const desconectar = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: typeof avisar) {
          avisar = callback
        }
        observe() {}
        disconnect = desconectar
      },
    )
    render(<Revelar>conteúdo</Revelar>)
    expect(screen.getByText('conteúdo')).toHaveAttribute('data-visivel', 'false')
    act(() => avisar([{ isIntersecting: true }]))
    expect(screen.getByText('conteúdo')).toHaveAttribute('data-visivel', 'true')
    expect(desconectar).toHaveBeenCalled()
  })
})
