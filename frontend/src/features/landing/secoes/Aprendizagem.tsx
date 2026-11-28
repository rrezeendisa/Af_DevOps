import { BookOpen, SlidersHorizontal, Sparkles } from 'lucide-react'
import { Foto } from '@/components/arte/Foto'
import { Revelar } from '@/components/motion/Revelar'
import { cn } from '@/lib/utils'
import { Titulo } from './Titulo'

const PONTOS = [
  { Icone: BookOpen, titulo: 'Catálogo organizado', texto: 'Cursos por categoria e nível, com carga horária e descrição.' },
  { Icone: SlidersHorizontal, titulo: 'Autoavaliação simples', texto: 'Três competências, notas de 1 a 5 e escolha explícita.' },
  { Icone: Sparkles, titulo: 'Resultados no seu contexto', texto: 'Recomendações e orientação aparecem durante a sessão aberta.' },
]

export function Aprendizagem() {
  return (
    <section id="aprendizagem" aria-labelledby="titulo-aprendizagem" tabIndex={-1} className="scroll-mt-20 py-secao outline-none">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-5 sm:px-8 lg:grid-cols-12">
        <Revelar className="order-2 lg:order-none lg:col-span-7">
          <div className="relative grid grid-cols-2 items-start gap-3 sm:block sm:pb-24 lg:pb-28">
            <div className="col-span-2 aspect-[16/11] overflow-hidden rounded-4xl border border-border bg-lavagem-lilas shadow-neon sm:aspect-[16/10]">
              <Foto
                nome="experiencia-estudo"
                alt="Mulher de blusa verde-lima navega por um catálogo de cursos em um notebook"
                largura={1586}
                altura={992}
                fallback={null}
              />
            </div>
            <figure className="overflow-hidden rounded-3xl border border-border bg-surface shadow-neon sm:absolute sm:bottom-0 sm:left-8 sm:w-64">
              <div className="aspect-video bg-lavagem-lima">
                <Foto
                  nome="capa-seguranca"
                  alt="Mulher confirma um acesso pelo celular diante de um notebook com um cadeado na tela"
                  largura={1280}
                  altura={720}
                  fallback={null}
                />
              </div>
              <figcaption className="grid gap-1 p-4">
                <span className="text-sm font-semibold">Segurança da informação</span>
                <span className="text-xs text-muted-foreground">Intermediário · exemplo ilustrativo</span>
              </figcaption>
            </figure>
            <figure className="rounded-3xl border border-border bg-surface p-3 shadow-neon sm:absolute sm:right-6 sm:bottom-8 sm:w-60 sm:p-4">
              <figcaption className="grid gap-3">
                <span className="text-sm font-semibold">Tecnologia</span>
                <span aria-hidden="true" className="flex gap-1 sm:gap-1.5">
                  {[1, 2, 3, 4, 5].map((nota) => (
                    <span key={nota} className={cn('flex aspect-square flex-1 items-center justify-center rounded-lg text-xs font-semibold sm:text-sm', nota === 4 ? 'bg-primary text-primary-foreground' : 'bg-surface-2')}>
                      {nota}
                    </span>
                  ))}
                </span>
                <span className="text-xs text-muted-foreground">Autoavaliação, ilustrativa</span>
              </figcaption>
            </figure>
          </div>
        </Revelar>

        <div className="order-1 grid gap-9 lg:order-none lg:col-span-5 lg:pl-6">
          <Titulo id="titulo-aprendizagem" rotulo="Experiência de aprendizagem" titulo={<>Aprender com <em className="font-medium">contexto</em>.</>} />
          <ul className="grid divide-y divide-border">
            {PONTOS.map(({ Icone, titulo, texto }) => (
              <li key={titulo} className="grid grid-cols-[auto_1fr] gap-4 py-5">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-lavagem-lilas">
                  <Icone aria-hidden="true" className="size-5 text-brand-detail" strokeWidth={1.75} />
                </span>
                <span className="grid gap-1">
                  <span className="font-semibold">{titulo}</span>
                  <span className="text-sm text-muted-foreground">{texto}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
