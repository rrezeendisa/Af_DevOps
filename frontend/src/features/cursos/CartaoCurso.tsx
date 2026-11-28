import { ArrowUpRight, Clock } from 'lucide-react'
import { Link } from 'react-router'
import { Foto } from '@/components/arte/Foto'
import { formatarHoras } from '@/lib/formatacao'
import type { Curso } from './api'
import { BadgeNivel } from './BadgeNivel'
import { capaDoCurso } from './capas'

/** Cartão do catálogo: dados reais do curso e capa ilustrativa (sem progresso ou matrícula). */
export function CartaoCurso({ curso }: { curso: Curso }) {
  const { foto, enquadre } = capaDoCurso(curso)
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-baixa transition-[translate,box-shadow] duration-300 hover:shadow-media motion-safe:hover:-translate-y-1">
      <div className="aspect-[16/8] overflow-hidden bg-lavagem-lilas">
        <Foto nome={foto} alt="" largura={640} altura={320} fallback={null} className={enquadre} />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <span className="inline-flex h-6 items-center self-start rounded-full bg-lavagem-lilas px-2.5 text-xs font-medium">
          {curso.categoria}
        </span>
        <h2 className="font-sans text-lg leading-snug font-semibold">
          <Link
            to={`/cursos/${curso.id}`}
            className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-3xl focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
          >
            {curso.nome}
          </Link>
        </h2>
        <p className="line-clamp-2 text-sm text-muted-foreground">{curso.descricao}</p>
        <div className="mt-auto flex items-center gap-3 pt-1 text-sm text-muted-foreground">
          <BadgeNivel nivel={curso.nivel} />
          <span className="inline-flex items-center gap-1.5">
            <Clock aria-hidden="true" className="size-4 text-brand-detail" strokeWidth={1.75} />
            {formatarHoras(curso.cargaHoraria)}
          </span>
          <ArrowUpRight aria-hidden="true" className="ml-auto size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </article>
  )
}
