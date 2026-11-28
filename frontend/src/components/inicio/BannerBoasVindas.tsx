import { FormasOrganicas } from '@/components/marca/FormasOrganicas'

type Props = { titulo: string; subtitulo: string }

/** Banner institucional da página inicial: lilás no claro, grafite com borda lilás no escuro. */
export function BannerBoasVindas({ titulo, subtitulo }: Props) {
  return (
    <section
      aria-labelledby="titulo-inicio"
      className="relative isolate overflow-hidden rounded-3xl bg-accent px-6 py-10 sm:px-10 sm:py-14 dark:border dark:border-accent/40 dark:bg-surface-2"
    >
      <FormasOrganicas className="absolute top-1/2 right-8 -z-10 hidden max-h-[calc(100%-3rem)] w-[min(34%,15rem)] -translate-y-1/2 sm:block" />
      <div className="max-w-[min(100%,36rem)] sm:max-w-[62%]">
        <h1
          id="titulo-inicio"
          className="text-4xl leading-[1.05] font-bold tracking-[-0.02em] text-accent-foreground sm:text-5xl lg:text-6xl dark:text-foreground"
        >
          {titulo}
        </h1>
        <p className="mt-4 text-lg text-accent-foreground/90 sm:text-2xl dark:text-muted-foreground">{subtitulo}</p>
      </div>
    </section>
  )
}
