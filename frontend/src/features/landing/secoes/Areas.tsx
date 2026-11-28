import { Foto } from '@/components/arte/Foto'
import type { NomeFoto } from '@/components/arte/fotos'
import { Revelar } from '@/components/motion/Revelar'
import { cn } from '@/lib/utils'
import { Titulo } from './Titulo'

const CARTAO =
  'group relative isolate h-full overflow-hidden rounded-4xl border border-border bg-surface shadow-neon transition-[translate,box-shadow] duration-300 ease-suave motion-safe:hover:-translate-y-1 hover:shadow-alta'

/** Ampliação discreta ao passar o mouse, contida no cartão. */
const ZOOM = 'transition-[scale] duration-700 ease-suave motion-safe:group-hover:scale-[1.03]'

type PropsFoto = {
  nome: Extract<NomeFoto, `area-${string}`>
  alt: string
  largura: number
  altura: number
  /** Enquadramento do recorte (`object-position`). */
  enquadre: string
}

function FotoDaArea({ nome, alt, largura, altura, enquadre }: PropsFoto) {
  return <Foto nome={nome} alt={alt} largura={largura} altura={altura} fallback={null} className={cn(ZOOM, enquadre)} />
}

/** Véu na cor da superfície do cartão (acompanha o tema). Decorativo. */
function Veu({ className }: { className: string }) {
  return <span aria-hidden="true" data-veu="" className={cn('pointer-events-none absolute', className)} />
}

function Temas({ itens }: { itens: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {itens.map((item) => (
        <li key={item} className="rounded-full border border-foreground/15 bg-surface/90 px-3 py-1 text-xs font-medium">
          {item}
        </li>
      ))}
    </ul>
  )
}

export function Areas() {
  return (
    <section id="areas" aria-labelledby="titulo-areas" tabIndex={-1} className="scroll-mt-20 py-secao outline-none">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-5 sm:px-8">
        <div className="grid items-end gap-6 lg:grid-cols-12">
          <Titulo id="titulo-areas" rotulo="Desenvolvimento profissional" titulo={<>Três áreas, <em className="font-medium">muitos caminhos</em>.</>} className="lg:col-span-7" />
          <p className="text-muted-foreground lg:col-span-4 lg:col-start-9">
            O acervo de aprendizagem se organiza em tecnologia, comunicação e raciocínio lógico, com temas que vão da
            segurança da informação à facilitação de equipes.
          </p>
        </div>

        {/* Bento: à direita, 40% e 60% da altura. 58/42 a partir de xl; antes disso a coluna ficaria estreita. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-[58fr_42fr] lg:grid-rows-[minmax(16rem,auto)_minmax(22rem,auto)] xl:grid-rows-[minmax(14rem,auto)_minmax(21rem,auto)]">
          <Revelar className="lg:row-span-2">
            <article className={cn(CARTAO, 'flex flex-col')}>
              <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[16/10] lg:aspect-auto lg:min-h-80 lg:flex-[1_1_66%]">
                <div className="absolute inset-0">
                  <FotoDaArea
                    nome="area-tecnologia"
                    alt="Jovem de cabelo cacheado, óculos e fones lilás escreve em um caderno diante de um tablet"
                    largura={1536}
                    altura={1024}
                    enquadre="object-[55%_12%] xl:object-[48%_12%]"
                  />
                </div>
                <Veu className="veu-base inset-x-0 -bottom-px h-[30%]" />
              </div>
              <div className="relative grid gap-4 px-7 pt-1 pb-7 sm:px-9 sm:pb-9">
                <h3 className="font-heading text-3xl font-semibold sm:text-4xl">Tecnologia</h3>
                <p className="max-w-lg text-muted-foreground">Das ferramentas do dia a dia aos fundamentos de desenvolvimento, com atenção à proteção de dados.</p>
                <Temas itens={['Segurança da informação', 'Desenvolvimento de software', 'Fundamentos digitais']} />
              </div>
            </article>
          </Revelar>

          <Revelar ordem={1}>
            {/* No celular, foto acima e texto abaixo; a partir de sm, uma só composição horizontal. */}
            <article className={cn(CARTAO, 'flex flex-col sm:min-h-64 sm:justify-center xl:min-h-56')}>
              <div className="relative h-60 overflow-hidden sm:absolute sm:top-0 sm:right-0 sm:-z-10 sm:aspect-video sm:h-full xl:h-[116%]">
                <div className="absolute inset-0">
                  <FotoDaArea
                    nome="area-comunicacao"
                    alt="Homem de barba e óculos, com blusa roxa, sorri e gesticula diante de um notebook"
                    largura={1672}
                    altura={941}
                    enquadre="object-[78%_0%]"
                  />
                </div>
                <Veu className="veu-base inset-x-0 -bottom-px h-2/5 sm:hidden" />
              </div>
              <Veu className="veu-lateral inset-0 -z-10 hidden sm:block" />
              <div className="relative grid content-center gap-3 px-7 pt-1 pb-7 sm:w-[56%] sm:py-6 sm:pr-0">
                <h3 className="font-heading text-3xl font-semibold">Comunicação</h3>
                <p className="text-muted-foreground">Clareza em mensagens e reuniões, assertividade e apresentações.</p>
                <Temas itens={['Assertividade', 'Apresentações']} />
              </div>
            </article>
          </Revelar>

          <Revelar ordem={2}>
            <article className={cn(CARTAO, 'flex flex-col justify-end sm:min-h-[22rem] xl:min-h-[21rem]')}>
              <div className="relative h-64 overflow-hidden sm:absolute sm:top-0 sm:right-0 sm:bottom-0 sm:-z-10 sm:aspect-video sm:h-auto sm:min-w-full lg:-right-8 xl:right-0">
                <div className="absolute inset-0">
                  <FotoDaArea
                    nome="area-logica"
                    alt="Mulher de cabelo preso e blusa verde-lima olha para cima com uma caneta junto ao rosto"
                    largura={1672}
                    altura={941}
                    enquadre="object-[80%_0%]"
                  />
                </div>
                <Veu className="veu-base inset-x-0 -bottom-px h-2/5 sm:hidden" />
              </div>
              <Veu className="veu-canto inset-0 -z-10 hidden sm:block" />
              <div className="relative grid gap-4 px-7 pt-1 pb-7">
                <h3 className="font-heading text-3xl font-semibold">Raciocínio lógico</h3>
                <p className="max-w-sm text-muted-foreground">Decomposição de problemas, algoritmos e pensamento computacional.</p>
                <Temas itens={['Lógica de programação', 'Resolução de problemas']} />
              </div>
            </article>
          </Revelar>
        </div>
      </div>
    </section>
  )
}
