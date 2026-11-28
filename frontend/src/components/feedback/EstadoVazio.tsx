import { Inbox, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  titulo: string
  descricao?: string
  icone?: LucideIcon
  acao?: ReactNode
}

export function EstadoVazio({ titulo, descricao, icone: Icone = Inbox, acao }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Icone aria-hidden="true" className="size-5" />
      </span>
      <p className="text-base font-semibold">{titulo}</p>
      {descricao && <p className="max-w-prose text-sm text-muted-foreground">{descricao}</p>}
      {acao}
    </div>
  )
}
