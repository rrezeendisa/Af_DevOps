import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  tom: 'colaborador' | 'admin'
  titulo: string
  subtitulo: string
  rotulo?: string
  acao: ReactNode
  /** Decoração à direita; nunca passa sobre o texto. */
  arte: ReactNode
}

/** Banner de abertura das páginas iniciais. */
export function Banner({ tom, titulo, subtitulo, rotulo, acao, arte }: Props) {
  return (
    <section
      aria-labelledby="titulo-inicio"
      className={cn(
        'relative isolate grid overflow-hidden rounded-4xl border border-border sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]',
        tom === 'admin' ? 'banner-admin' : 'banner-colaborador',
      )}
    >
      <div className="grid content-center justify-items-start gap-3 px-6 py-8 sm:px-10 sm:py-10">
        {rotulo && <p className="rotulo-editorial text-brand-detail">{rotulo}</p>}
        <h1 id="titulo-inicio" className="text-3xl leading-[1.08] font-bold tracking-[-0.02em] sm:text-4xl xl:text-5xl">
          {titulo}
        </h1>
        <p className="max-w-md text-base text-foreground sm:text-lg">{subtitulo}</p>
        <div className="mt-2">{acao}</div>
      </div>
      <div className="relative min-h-40 sm:min-h-56">{arte}</div>
    </section>
  )
}
