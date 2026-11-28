import { useState } from 'react'
import { cn } from '@/lib/utils'
import { DECORATIVOS, type NomeDecorativo } from './decorativos'

/** Movimentos com durações diferentes; todos desligados com movimento reduzido. */
const MOVIMENTO = {
  parado: '',
  flutuar: 'motion-safe:animate-flutuar',
  derivar: 'motion-safe:animate-derivar',
  balancar: 'motion-safe:animate-balancar',
} as const

type Props = {
  nome: NomeDecorativo
  /** Posição, tamanho e profundidade (desfoque, opacidade). */
  className?: string
  movimento?: keyof typeof MOVIMENTO
}

/** Elemento flutuante: fora da leitura, do foco e dos cliques. Some se a imagem falhar. */
export function Decorativo({ nome, className, movimento = 'parado' }: Props) {
  const [falhou, setFalhou] = useState(false)
  const { src, largura, altura } = DECORATIVOS[nome]
  if (falhou) return null
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      data-decorativo={nome}
      width={largura}
      height={altura}
      draggable={false}
      decoding="async"
      onError={() => setFalhou(true)}
      className={cn('pointer-events-none absolute h-auto select-none', MOVIMENTO[movimento], className)}
    />
  )
}
