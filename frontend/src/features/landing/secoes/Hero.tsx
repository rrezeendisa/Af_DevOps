import { ChartNoAxesCombined, FileText } from 'lucide-react'
import { SeloFlutuante } from '@/components/arte/SeloFlutuante'
import { Button } from '@/components/ui/button'
import { EsculturaHero } from '../EsculturaHero'
import { AcaoPrincipal } from './AcaoPrincipal'

export function Hero() {
  return (
    <section id="inicio" aria-labelledby="titulo-hero" tabIndex={-1} className="fundo-neon-aberto relative scroll-mt-20 outline-none">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-6 px-5 pt-8 pb-8 sm:px-8 lg:grid-cols-12 lg:gap-8 lg:pt-6 lg:pb-10">
        <div className="grid gap-7 lg:col-span-7 lg:pr-6">
          <p className="rotulo-editorial">Educação corporativa com inteligência artificial</p>
          <h1 id="titulo-hero" className="text-display font-bold">
            Inteligência que{' '}
            <em className="texto-neon font-medium">desenvolve</em>{' '}
            pessoas.
          </h1>
          <p className="max-w-xl text-subtitulo text-muted-foreground">
            Conheça suas competências, descubra novas possibilidades de aprendizagem e receba orientações para o seu
            desenvolvimento profissional.
          </p>
          <div className="flex flex-wrap gap-3">
            <AcaoPrincipal className="shadow-neon" />
            <Button asChild size="lg" variant="outline">
              <a href="#areas">Conheça a Evolia</a>
            </Button>
          </div>
          <ul aria-label="Competências avaliadas" className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {['Lógica', 'Comunicação', 'Tecnologia'].map((competencia, indice) => (
              <li key={competencia} className="flex items-center gap-2">
                <span aria-hidden="true" className={['bg-highlight', 'bg-primary', 'bg-secondary'][indice] + ' size-2.5 rounded-full'} />
                {competencia}
              </li>
            ))}
          </ul>
        </div>

        {/* Sem moldura: a imagem avança um pouco sobre as margens para ganhar presença. */}
        <figure className="relative mt-6 mb-12 -ml-5 aspect-square w-[calc(100%+2.5rem)] sm:mx-auto sm:mt-0 sm:mb-4 sm:w-full sm:max-w-[38rem] lg:col-span-5 lg:mb-0 lg:-ml-14 lg:w-[calc(100%+5.5rem)] lg:max-w-none">
          <EsculturaHero />
          <SeloFlutuante vidro icone={ChartNoAxesCombined} titulo="Nível estimado" detalhe="Intermediário" ilustrativo flutuar className="absolute -top-9 left-3 sm:-top-4 sm:left-0 lg:-top-8 xl:-top-4" />
          <SeloFlutuante vidro icone={FileText} tom="lima" titulo="Fonte consultada" detalhe="Documento do acervo" ilustrativo className="absolute right-3 -bottom-10 sm:right-0 sm:-bottom-4 lg:right-8 lg:-bottom-8" />
          <figcaption className="sr-only">Composição ilustrativa, sem dados reais de pessoas.</figcaption>
        </figure>
      </div>
    </section>
  )
}
