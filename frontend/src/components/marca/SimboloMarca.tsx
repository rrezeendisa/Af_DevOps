import { useState } from 'react'
import simbolo from '@/assets/marca/simbolo-evolia.webp'
import { cn } from '@/lib/utils'
import { SimboloEvolia } from './SimboloEvolia'

type Props = {
  className?: string
  /** Repassado ao SVG de reserva. */
  sobreLilas?: boolean
}

/**
 * Símbolo da assinatura: as quatro pétalas em vidro iridescente. Decorativo, porque o nome “Evolia”
 * acompanha em texto. Se a imagem falhar, entra o SVG original.
 */
export function SimboloMarca({ className, sobreLilas = false }: Props) {
  const [falhou, setFalhou] = useState(false)

  if (falhou) return <SimboloEvolia {...(className ? { className } : {})} sobreLilas={sobreLilas} />
  return (
    <img
      src={simbolo}
      alt=""
      width={144}
      height={144}
      decoding="async"
      onError={() => setFalhou(true)}
      className={cn('size-8 shrink-0 object-contain', className)}
    />
  )
}
