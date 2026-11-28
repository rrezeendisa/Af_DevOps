import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** Texto do total de resultados, anunciado a leitores de tela quando muda. */
  resumo: string
}

/** Área de busca e filtros locais, com contador de resultados. */
export function BarraFiltros({ children, resumo }: Props) {
  return (
    <div className="grid gap-2">
      <div role="search" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))] [&_input]:h-11 [&_input]:rounded-xl [&_select]:h-11 [&_select]:rounded-xl">
        {children}
      </div>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {resumo}
      </p>
    </div>
  )
}
