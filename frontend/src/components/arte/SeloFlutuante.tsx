import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  icone: LucideIcon
  titulo: string
  detalhe?: string
  /** Obrigatório quando o conteúdo não for um dado real da pessoa ou do servidor. */
  ilustrativo?: boolean
  tom?: 'lilas' | 'rosa' | 'lima'
  flutuar?: boolean
  /** Superfície translúcida em vez de opaca. */
  vidro?: boolean
  className?: string
}

const TOM = { lilas: 'bg-accent', rosa: 'bg-primary', lima: 'bg-highlight' } as const

/** Ficha sobreposta às composições. */
export function SeloFlutuante({ icone: Icone, titulo, detalhe, ilustrativo, tom = 'lilas', flutuar, vidro, className }: Props) {
  return (
    <div
      className={cn(
        'flex max-w-64 items-center gap-3 rounded-2xl py-2.5 pr-4 pl-2.5',
        vidro ? 'vidro shadow-neon' : 'bg-surface shadow-alta',
        flutuar && 'motion-safe:animate-flutuar',
        className,
      )}
    >
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl text-primary-foreground', TOM[tom])}>
        <Icone aria-hidden="true" className="size-5" strokeWidth={1.75} />
      </span>
      <span className="grid min-w-0">
        <span className="text-sm font-semibold text-foreground">{titulo}</span>
        {detalhe && <span className="text-xs text-muted-foreground">{detalhe}</span>}
        {ilustrativo && <span className="text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">Ilustrativo</span>}
      </span>
    </div>
  )
}
