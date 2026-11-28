import type { ReactNode } from 'react'

type Props = {
  titulo: string
  descricao?: ReactNode
  /** Elemento ao lado do título (ex.: badge de situação). */
  selo?: ReactNode
  acoes?: ReactNode
}

export function CabecalhoPagina({ titulo, descricao, selo, acoes }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-[-0.01em] text-foreground sm:text-4xl">{titulo}</h1>
          {selo}
        </div>
        {descricao && <p className="max-w-prose text-base text-muted-foreground">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </header>
  )
}
