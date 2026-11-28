import { FileText, Sparkles } from 'lucide-react'
import { PetalasVivas } from '@/components/arte/PetalasVivas'
import { MascoteEvolia } from '@/components/marca/MascoteEvolia'
import { Revelar } from '@/components/motion/Revelar'
import { RECURSOS } from '../dados'
import { Titulo } from './Titulo'

function Demonstracao() {
  return (
    <figure aria-labelledby="legenda-demo" className="grid gap-4 rounded-4xl border border-neon-violet/30 bg-surface p-5 shadow-neon sm:p-7">
      <figcaption id="legenda-demo" className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <PetalasVivas className="size-12" />
          <span className="font-heading text-lg font-semibold">Orientador Evolia</span>
        </span>
        <span className="rounded-full bg-highlight px-3 py-1 text-xs font-semibold text-highlight-foreground">Demonstração ilustrativa</span>
      </figcaption>
      <p className="ml-auto max-w-[85%] rounded-3xl rounded-br-md bg-accent px-4 py-3 text-sm text-accent-foreground">
        Como posso desenvolver minhas competências em tecnologia?
      </p>
      <p className="max-w-[92%] rounded-3xl rounded-bl-md bg-surface-2 px-4 py-3 text-sm">
        A classificação estimada pelo modelo é INTERMEDIARIO. Os documentos consultados recomendam: Segurança da
        informação no cotidiano.
      </p>
      <div className="grid gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold">
          <Sparkles aria-hidden="true" className="size-3.5 text-brand-detail" />
          Próximos passos · gerado por IA
        </p>
        <ol className="grid gap-2 sm:grid-cols-3">
          {['Revise a proteção de contas', 'Pratique identificar riscos', 'Compartilhe o aprendizado'].map((passo, indice) => (
            <li key={passo} className="rounded-2xl border border-border p-3 text-xs">
              <span className="mb-1 block font-heading text-lg italic">{indice + 1}</span>
              {passo}
            </li>
          ))}
        </ol>
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileText aria-hidden="true" className="size-3.5" />
        Fonte: documento do acervo
      </p>
    </figure>
  )
}

export function Inteligencia() {
  return (
    <section id="inteligencia" aria-labelledby="titulo-ia" tabIndex={-1} className="fundo-neon-aberto scroll-mt-20 py-secao outline-none">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:gap-8">
        <div className="grid content-start gap-8 lg:col-span-6 lg:pr-8">
          <Titulo id="titulo-ia" rotulo="Recursos de inteligência artificial" titulo={<>Inteligência que <em className="font-medium">explica</em> o que sugere.</>} />
          <ol className="border-t border-foreground/20">
            {RECURSOS.map((recurso, indice) => (
              <li key={recurso.titulo} className="grid grid-cols-[3rem_1fr] gap-3 border-b border-foreground/20 py-5">
                <span aria-hidden="true" className="font-heading text-2xl italic">
                  {String(indice + 1).padStart(2, '0')}
                </span>
                <div className="grid gap-1.5">
                  <h3 className="font-heading text-xl font-semibold">{recurso.titulo}</h3>
                  <p className="text-sm text-muted-foreground">{recurso.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <Revelar className="self-center lg:col-span-6">
          {/* O mascote apresenta a demonstração; a ponta de baixo encosta no cartão. */}
          <div className="relative z-10 -mb-3 flex justify-center sm:justify-end sm:pr-10">
            <MascoteEvolia className="w-40 sm:w-52" />
          </div>
          <Demonstracao />
        </Revelar>
      </div>
    </section>
  )
}
