import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Qual canto fica em ponta, como cada pétala do símbolo. */
export type CantoPetala = 'inferior-direito' | 'inferior-esquerdo' | 'superior-esquerdo' | 'superior-direito'

const RECORTE: Record<CantoPetala, string> = {
  'inferior-direito': 'rounded-[48%_48%_6%_48%]',
  'inferior-esquerdo': 'rounded-[48%_48%_48%_6%]',
  'superior-esquerdo': 'rounded-[6%_48%_48%_48%]',
  'superior-direito': 'rounded-[48%_6%_48%_48%]',
}

/**
 * Recorta o conteúdo na forma de pétala. É a assinatura da marca: usar com parcimônia, no máximo
 * um destaque por dobra.
 */
export function MascaraPetala({
  canto = 'inferior-direito',
  className,
  children,
}: {
  canto?: CantoPetala
  className?: string
  children: ReactNode
}) {
  return <div className={cn('overflow-hidden', RECORTE[canto], className)}>{children}</div>
}
