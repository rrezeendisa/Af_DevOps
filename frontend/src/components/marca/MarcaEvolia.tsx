import { cn } from '@/lib/utils'
import { SimboloMarca } from './SimboloMarca'

export const SLOGAN = 'Inteligência que desenvolve pessoas.'

type Props = {
  className?: string
  tamanho?: 'md' | 'lg'
  comSlogan?: boolean
  /** Ajusta o SVG de reserva para fundo lilás. */
  sobreLilas?: boolean
}

/** Símbolo e wordmark “Evolia” em Fraunces, com slogan opcional. */
export function MarcaEvolia({ className, tamanho = 'md', comSlogan = false, sobreLilas = false }: Props) {
  const grande = tamanho === 'lg'
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <SimboloMarca className={grande ? 'size-12' : 'size-9'} sobreLilas={sobreLilas} />
      <div className="flex flex-col">
        <span
          className={cn(
            'font-heading leading-none font-semibold tracking-[-0.02em] text-foreground',
            grande ? 'text-4xl' : 'text-[1.75rem]',
          )}
        >
          Evolia
        </span>
        {comSlogan && <span className="mt-1.5 text-sm text-muted-foreground">{SLOGAN}</span>}
      </div>
    </div>
  )
}
