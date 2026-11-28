import { ArrowRight, Brain, Code2, MessageCircle } from 'lucide-react'
import { Link } from 'react-router'
import { Foto } from '@/components/arte/Foto'
import type { NomeFoto } from '@/components/arte/fotos'
import { cn } from '@/lib/utils'

type Area = { nome: string; foto: NomeFoto; enquadre: string; icone: typeof Code2; tom: string }

const AREAS: readonly Area[] = [
  { nome: 'Tecnologia', foto: 'area-tecnologia', enquadre: 'object-[50%_18%]', icone: Code2, tom: 'bg-lavagem-lilas' },
  { nome: 'Comunicação', foto: 'area-comunicacao', enquadre: 'object-[82%_22%]', icone: MessageCircle, tom: 'bg-lavagem-rosa' },
  { nome: 'Raciocínio lógico', foto: 'area-logica', enquadre: 'object-[76%_18%]', icone: Brain, tom: 'bg-lavagem-lima' },
]

/**
 * As três áreas, com as fotografias da landing. Não faz buscas: a ação leva ao catálogo completo,
 * que não filtra por área pelo endereço.
 */
export function AreasDeCompetencia() {
  return (
    <section aria-labelledby="titulo-areas-inicio" className="grid gap-4">
      <h2 id="titulo-areas-inicio" className="text-2xl font-semibold">
        Explore suas competências
      </h2>
      <ul className="grid gap-4 md:grid-cols-3">
        {AREAS.map(({ nome, foto, enquadre, icone: Icone, tom }) => (
          <li
            key={nome}
            className="group relative overflow-hidden rounded-3xl border border-border bg-surface shadow-baixa transition-[translate,box-shadow] duration-300 focus-within:ring-2 focus-within:ring-ring hover:shadow-media motion-safe:hover:-translate-y-1"
          >
            <div className={cn('aspect-[16/8] overflow-hidden md:aspect-[16/9]', tom)}>
              <Foto nome={foto} alt="" largura={1536} altura={1024} fallback={null} className={enquadre} />
            </div>
            <div className="flex items-center gap-3 p-4">
              <div className="grid min-w-0 flex-1 gap-1">
                <h3 className="font-heading text-xl font-semibold">{nome}</h3>
                <Link
                  to="/cursos"
                  aria-label={`Explorar cursos: ${nome}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-detail outline-none after:absolute after:inset-0 hover:underline"
                >
                  Explorar cursos
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
              <span aria-hidden="true" className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl text-brand-detail', tom)}>
                <Icone className="size-5" strokeWidth={1.75} />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
