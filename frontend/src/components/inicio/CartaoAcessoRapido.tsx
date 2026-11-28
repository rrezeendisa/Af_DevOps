import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import type { Rota, TomRota } from '@/app/rotas'
import { BadgePendente } from '@/components/feedback/BadgeStatus'
import { cn } from '@/lib/utils'

// Ícone sempre em #211C26 (primary-foreground), que mantém de 6,2:1 a 12,5:1 sobre os três ladrilhos.
const LADRILHO: Record<TomRota, string> = {
  rosa: 'bg-primary',
  lima: 'bg-highlight',
  lilas: 'bg-accent',
}

export function CartaoAcessoRapido({ rota }: { rota: Rota }) {
  const Icone = rota.icone
  return (
    <Link
      to={rota.caminho}
      className={cn(
        'group flex h-full flex-col gap-4 rounded-2xl border border-border bg-surface p-5 transition-[border-color,box-shadow] outline-none',
        'hover:border-input hover:shadow-[0_4px_12px_rgb(33_28_38/0.06)]',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn('flex size-12 items-center justify-center rounded-xl text-primary-foreground', LADRILHO[rota.tom])}>
          <Icone aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </span>
        {rota.situacao === 'pendente' && <BadgePendente />}
      </div>
      <span className="text-[1.0625rem] font-semibold text-foreground">{rota.titulo}</span>
      <span className="text-sm text-muted-foreground">{rota.descricao}</span>
      <ArrowUpRight
        aria-hidden="true"
        className="mt-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      />
    </Link>
  )
}
