import { MascoteEvolia } from '@/components/marca/MascoteEvolia'
import { Revelar } from '@/components/motion/Revelar'
import { COMPROMISSOS } from '../dados'

export function UsoResponsavel() {
  return (
    <section id="uso-responsavel" aria-labelledby="titulo-uso" tabIndex={-1} className="scroll-mt-20 py-secao outline-none">
      <div className="mx-auto grid max-w-5xl gap-14 px-5 sm:px-8">
        <div className="grid justify-items-center gap-6 text-center">
          <MascoteEvolia pose="comemorando" className="w-28 sm:w-36" />
          <p className="rotulo-editorial">Uso responsável da IA</p>
          <h2 id="titulo-uso" className="max-w-3xl text-titulo font-semibold">
            Você decide <em className="font-medium">quando</em> a IA pode usar seus dados.
          </h2>
        </div>
        <Revelar>
          <dl className="grid gap-x-14 sm:grid-cols-2">
            {COMPROMISSOS.map((item) => (
              <div key={item.titulo} className="grid gap-2 border-t border-border py-6">
                <dt className="font-heading text-xl font-semibold">{item.titulo}</dt>
                <dd className="text-muted-foreground">{item.texto}</dd>
              </div>
            ))}
          </dl>
        </Revelar>
      </div>
    </section>
  )
}
