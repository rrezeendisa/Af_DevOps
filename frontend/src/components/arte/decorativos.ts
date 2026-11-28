import mascote from '@/assets/fotos/mascote-evolia.webp'
import petalas from '@/assets/fotos/petalas-3d.webp'

/** Elementos tridimensionais reutilizáveis como decoração. Origem em `src/assets/CREDITOS.md`. */
export const DECORATIVOS = {
  mascote: { src: mascote, largura: 640, altura: 770 },
  petalas: { src: petalas, largura: 768, altura: 768 },
} as const

export type NomeDecorativo = keyof typeof DECORATIVOS
