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
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-surface px-6 py-12 text-center shadow-baixa">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-lavagem-lilas text-brand-detail">
        <Icone aria-hidden="true" className="size-5" />
      </span>
      <p className="font-heading text-xl font-semibold">{titulo}</p>
      {descricao && <p className="max-w-prose text-sm text-muted-foreground">{descricao}</p>}
      {acao}
    </div>
  )
}
