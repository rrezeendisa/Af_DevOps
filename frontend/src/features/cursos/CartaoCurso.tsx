import { ArrowUpRight, Clock } from 'lucide-react'
import { Link } from 'react-router'
import { formatarHoras } from '@/lib/formatacao'
import type { Curso } from './api'
import { BadgeNivel } from './BadgeNivel'

/** Cartão do catálogo: só dados reais do curso (sem imagem, progresso ou matrícula). */
export function CartaoCurso({ curso }: { curso: Curso }) {
  return (
    <article className="group relative flex h-full flex-col gap-4 rounded-2xl border border-border bg-surface p-5 transition-[border-color,box-shadow] hover:border-input hover:shadow-[0_4px_12px_rgb(33_28_38/0.06)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-6 items-center rounded-full border border-border bg-surface px-2.5 text-xs font-medium text-muted-foreground">
          {curso.categoria}
        </span>
        <BadgeNivel nivel={curso.nivel} />
      </div>
      <h2 className="font-sans text-lg leading-snug font-semibold">
        <Link
          to={`/cursos/${curso.id}`}
          className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background"
        >
          {curso.nome}
        </Link>
      </h2>
      <p className="line-clamp-3 text-sm text-muted-foreground">{curso.descricao}</p>
      <div className="mt-auto flex items-center justify-between gap-3 pt-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock aria-hidden="true" className="size-4 text-brand-detail" strokeWidth={1.75} />
          {formatarHoras(curso.cargaHoraria)}
        </span>
        <ArrowUpRight
          aria-hidden="true"
          className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </div>
    </article>
  )
}
