import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BadgePendente, BadgeStatus } from './feedback/BadgeStatus'
import { EstadoCarregando } from './feedback/EstadoCarregando'
import { EstadoVazio } from './feedback/EstadoVazio'
import { MensagemErro } from './feedback/MensagemErro'
import { MascoteEvolia } from './marca/MascoteEvolia'
import { MarcaEvolia } from './marca/MarcaEvolia'
import { DESCRICAO_MASCOTE } from './marca/poses'
import { SimboloEvolia } from './marca/SimboloEvolia'
import { Button } from './ui/button'

describe('marca', () => {
  it('símbolo é decorativo sem rótulo e imagem nomeada com rótulo', () => {
    const { container, rerender } = render(<SimboloEvolia />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelectorAll('path')).toHaveLength(4)
    rerender(<SimboloEvolia rotulo="Evolia" />)
    expect(screen.getByRole('img', { name: 'Evolia' })).toBeInTheDocument()
  })

  it('marca mostra o wordmark em Fraunces e o slogan opcional', () => {
    const { rerender } = render(<MarcaEvolia />)
    expect(screen.getByText('Evolia')).toHaveClass('font-heading')
    expect(screen.queryByText('Inteligência que desenvolve pessoas.')).toBeNull()
    rerender(<MarcaEvolia comSlogan />)
    expect(screen.getByText('Inteligência que desenvolve pessoas.')).toBeInTheDocument()
  })
})

describe('marca em imagem', () => {
  it('usa o símbolo novo, decorativo, e volta ao SVG original se a imagem falhar', () => {
    const { container } = render(<MarcaEvolia />)
    const imagem = container.querySelector('img')!
    expect(imagem).toHaveAttribute('alt', '')
    expect(imagem.getAttribute('src')).toContain('simbolo-evolia')
    fireEvent.error(imagem)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelectorAll('svg path')).toHaveLength(4)
    expect(screen.getByText('Evolia')).toBeInTheDocument()
  })

  it('mascote tem descrição, pode ser decorativo e pode ficar parado', () => {
    const { container, rerender } = render(<MascoteEvolia />)
    expect(screen.getByRole('img', { name: DESCRICAO_MASCOTE })).toHaveClass('motion-safe:animate-flutuar')
    rerender(<MascoteEvolia decorativo flutuar={false} />)
    const imagem = container.querySelector('img')!
    expect(imagem).toHaveAttribute('alt', '')
    expect(imagem).not.toHaveClass('motion-safe:animate-flutuar')
  })
})

describe('feedback', () => {
  it('mensagem de erro é alerta e aviso é status, ambos com texto', () => {
    const { rerender } = render(<MensagemErro titulo="Falhou">Detalhe</MensagemErro>)
    expect(screen.getByRole('alert')).toHaveTextContent('FalhouDetalhe')
    rerender(
      <MensagemErro tom="aviso" titulo="Aviso">
        Informação
      </MensagemErro>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('AvisoInformação')
  })

  it('carregamento anuncia o texto', () => {
    render(<EstadoCarregando texto="Carregando cursos…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Carregando cursos…')
  })

  it('estado vazio mostra título e descrição', () => {
    render(<EstadoVazio titulo="Nada por aqui" descricao="Ainda não há registros." />)
    expect(screen.getByText('Nada por aqui')).toBeInTheDocument()
    expect(screen.getByText('Ainda não há registros.')).toBeInTheDocument()
  })

  it('badges expressam o estado por texto, com ícone decorativo', () => {
    const { container } = render(
      <>
        <BadgeStatus tom="sucesso">Concluído</BadgeStatus>
        <BadgePendente />
      </>,
    )
    expect(screen.getByText('Concluído')).toBeInTheDocument()
    expect(screen.getByText('Em desenvolvimento')).toBeInTheDocument()
    for (const icone of container.querySelectorAll('svg')) {
      expect(icone).toHaveAttribute('aria-hidden', 'true')
    }
  })
})

describe('botão', () => {
  it('tem 40 px de altura por padrão', () => {
    render(<Button>Salvar</Button>)
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveClass('h-10')
  })
})
