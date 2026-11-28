import { Revelar } from '@/components/motion/Revelar'
import { cn } from '@/lib/utils'
import { PASSOS } from '../dados'
import { Titulo } from './Titulo'

/** Em telas largas, os degraus sobem da esquerda para a direita: a jornada como evolução. */
const DEGRAU = ['lg:mt-40', 'lg:mt-30', 'lg:mt-20', 'lg:mt-10', 'lg:mt-0']
const MARCA = ['bg-highlight', 'bg-secondary', 'bg-primary', 'bg-highlight', 'bg-primary']

export function ComoFunciona() {
  return (
    <section id="como-funciona" aria-labelledby="titulo-como" tabIndex={-1} className="fundo-neon-aberto scroll-mt-20 py-secao outline-none">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 sm:px-8">
        <Titulo
          id="titulo-como"
          rotulo="Como funciona"
          titulo={<>Um passo de cada vez, <em className="font-medium">sempre para cima</em>.</>}
          apoio="Da primeira entrada à orientação, você conduz o ritmo."
        />
        <div className="relative lg:pb-24">
          {/* Curva que acompanha a subida dos degraus, por baixo deles. */}
          <svg
            viewBox="0 0 1200 260"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
            className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-64 w-full text-neon-violet drop-shadow-[0_0_10px_var(--color-neon-pink)] lg:block"
          >
            <path
              d="M0 246C190 252 300 226 470 204S760 190 880 128 1060 52 1196 38"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <ol className="relative grid gap-0 lg:grid-cols-5 lg:items-start lg:gap-4">
            {PASSOS.map((passo, indice) => (
              <li key={passo.titulo} className={cn('relative border-l border-foreground/20 pb-9 pl-8 last:pb-0 lg:border-l-0 lg:pb-0 lg:pl-0', DEGRAU[indice])}>
                <span aria-hidden="true" className={cn('absolute top-1.5 -left-[0.4rem] size-3 rounded-full lg:hidden', MARCA[indice])} />
                <Revelar ordem={Math.min(indice, 3) as 0 | 1 | 2 | 3} className="h-full">
                  <div className="grid h-full content-start gap-3 lg:rounded-3xl lg:border lg:border-border lg:bg-surface lg:p-5 lg:shadow-neon">
                    <span className="flex items-end gap-2">
                      <span aria-hidden="true" className="font-heading text-5xl leading-none font-medium italic">
                        {indice + 1}
                      </span>
                      <span aria-hidden="true" className={cn('mb-1 hidden h-2 w-8 rounded-full lg:block', MARCA[indice])} />
                    </span>
                    <h3 className="font-heading text-xl leading-snug font-semibold">{passo.titulo}</h3>
                    <p className="text-sm text-muted-foreground">{passo.texto}</p>
                  </div>
                </Revelar>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
