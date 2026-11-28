import { ArrowLeft, SearchX } from 'lucide-react'
import { Link } from 'react-router'
import { Foto } from '@/components/arte/Foto'
import { ErroConsulta } from '@/components/feedback/ErroConsulta'
import { EstadoCarregando } from '@/components/feedback/EstadoCarregando'
import { EstadoVazio } from '@/components/feedback/EstadoVazio'
import { CabecalhoPagina } from '@/components/layout/CabecalhoPagina'
import { Button } from '@/components/ui/button'
import { ehNaoEncontrado } from '@/lib/api/mensagens'
import { formatarDataHora, formatarHoras } from '@/lib/formatacao'
import { ROTULO_NIVEL_CURSO, useCurso } from './api'
import { BadgeNivel } from './BadgeNivel'
import { capaDoCurso } from './capas'

function VoltarAoCatalogo() {
  return (
    <Button asChild variant="ghost" className="justify-self-start px-2">
      <Link to="/cursos">
        <ArrowLeft aria-hidden="true" />
        Voltar ao catálogo
      </Link>
    </Button>
  )
}

export default function PaginaCurso({ id }: { id: number }) {
  const consulta = useCurso(id)

  if (consulta.isPending) {
    return <EstadoCarregando texto="Carregando curso…" />
  }
  if (consulta.isError) {
    return ehNaoEncontrado(consulta.error) ? (
      <div className="grid gap-6 pt-2">
        <VoltarAoCatalogo />
        <EstadoVazio icone={SearchX} titulo="Curso não encontrado" descricao="Ele pode ter sido removido ou o endereço está incorreto." />
      </div>
    ) : (
      <div className="grid gap-6 pt-2">
        <VoltarAoCatalogo />
        <ErroConsulta erro={consulta.error} titulo="Não foi possível carregar o curso" aoTentarNovamente={() => void consulta.refetch()} />
      </div>
    )
  }

  const curso = consulta.data
  const { foto, enquadre } = capaDoCurso(curso)
  return (
    <div className="grid max-w-5xl gap-6 pt-2">
      <VoltarAoCatalogo />
      <div className="aspect-[16/7] max-h-80 w-full overflow-hidden rounded-3xl border border-border bg-lavagem-lilas shadow-baixa sm:aspect-[16/5]">
        <Foto nome={foto} alt="" largura={1280} altura={400} fallback={null} prioridade className={enquadre} />
      </div>
      <CabecalhoPagina titulo={curso.nome} selo={<BadgeNivel nivel={curso.nivel} />} />
      <section aria-labelledby="titulo-sobre" className="grid gap-6 rounded-3xl border border-border bg-surface p-6 shadow-baixa sm:p-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-3">
          <h2 id="titulo-sobre" className="font-sans text-lg font-semibold">
            Sobre o curso
          </h2>
          <p className="text-base whitespace-pre-line text-muted-foreground">{curso.descricao}</p>
        </div>
        <dl className="grid content-start gap-4 rounded-2xl bg-lavagem-lilas p-5 text-sm">
          <div>
            <dt className="text-muted-foreground">Categoria</dt>
            <dd className="mt-0.5 font-semibold">{curso.categoria}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Nível</dt>
            <dd className="mt-0.5 font-semibold">{ROTULO_NIVEL_CURSO[curso.nivel]}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Carga horária</dt>
            <dd className="mt-0.5 font-semibold">{formatarHoras(curso.cargaHoraria)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cadastrado em</dt>
            <dd className="mt-0.5 font-semibold">{formatarDataHora(curso.criadoEm)}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
