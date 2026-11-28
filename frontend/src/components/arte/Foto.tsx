import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { urlDaFoto, type NomeFoto } from './fotos'

type Props = {
  nome: NomeFoto
  /** Descrição da foto. Vazio (`''`) quando for decorativa. */
  alt: string
  /** Mostrado enquanto não houver arquivo, ou se ele falhar ao carregar. */
  fallback: ReactNode
  largura: number
  altura: number
  /** `true` para a imagem principal da primeira dobra. */
  prioridade?: boolean
  className?: string
  /** Substitui o endereço (usado em testes). */
  src?: string
}

/** Fotografia local com dimensões declaradas, carregamento preguiçoso e fallback em SVG. */
export function Foto({ nome, alt, fallback, largura, altura, prioridade = false, className, src = urlDaFoto(nome) }: Props) {
  const [falhou, setFalhou] = useState(false)

  if (!src || falhou) {
    return (
      <div className={cn('size-full overflow-hidden', className)} data-foto-fallback={nome}>
        {fallback}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      width={largura}
      height={altura}
      loading={prioridade ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFalhou(true)}
      className={cn('size-full object-cover', className)}
    />
  )
}
