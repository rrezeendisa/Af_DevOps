import { ArrowUpRight, BookOpen, RotateCw, SquareActivity, Users, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { useColaboradores } from '@/features/colaboradores/api'
import { useCursos } from '@/features/cursos/api'
import { STATUS_TREINAMENTO, useTreinamentos, type StatusTreinamento } from '@/features/treinamentos/api'
import { mensagemDeErro } from '@/lib/api/mensagens'
import { formatarNumero, formatarPercentual } from '@/lib/formatacao'
import { cn } from '@/lib/utils'

type ConsultaLista = {
  isPending: boolean
  isError: boolean
  error: unknown
  data: readonly unknown[] | undefined
  refetch: () => unknown
}

function Indicador({ titulo, caminho, icone: Icone, consulta }: { titulo: string; caminho: string; icone: LucideIcon; consulta: ConsultaLista }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">{titulo}</h3>
        <Icone aria-hidden="true" className="size-4 text-brand-detail" strokeWidth={1.75} />
      </div>
      {consulta.isPending ? (
        <div role="status">
          <span className="sr-only">Carregando {titulo.toLowerCase()}…</span>
          <Skeleton aria-hidden="true" className="h-9 w-16 rounded-md bg-surface-2" />
        </div>
      ) : consulta.isError ? (
        <div className="grid justify-items-start gap-2" role="alert">
          <p className="text-sm text-destructive">{mensagemDeErro(consulta.error)}</p>
          <button
            type="button"
            onClick={() => void consulta.refetch()}
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold underline decoration-primary decoration-2 underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCw aria-hidden="true" className="size-3.5" />
            Tentar novamente
          </button>
        </div>
      ) : (
        <p className="text-4xl font-semibold tracking-[-0.02em] tabular-nums" data-testid={`total-${caminho}`}>
          {formatarNumero(consulta.data?.length ?? 0)}
        </p>
      )}
      <Link
        to={caminho}
        className="mt-auto inline-flex items-center gap-1 self-start rounded-sm text-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        Abrir {titulo.toLowerCase()}
        <ArrowUpRight aria-hidden="true" className="size-3.5" />
      </Link>
    </div>
  )
}

const VISUAL_STATUS: Record<StatusTreinamento, { rotulo: string; cor: string }> = {
  PENDENTE: { rotulo: 'Pendentes', cor: 'bg-accent' },
  CONCLUIDO: { rotulo: 'Concluídas', cor: 'bg-highlight' },
  FALHOU: { rotulo: 'Com falha', cor: 'bg-destructive' },
}

/** Distribuição real das solicitações por status: barra empilhada e números em texto. */
function DistribuicaoTreinamentos({ consulta }: { consulta: ReturnType<typeof useTreinamentos> }) {
  if (consulta.isPending || consulta.isError) {
    return null
  }
  const total = consulta.data.length
  const contagens = STATUS_TREINAMENTO.map((status) => ({
    status,
    quantidade: consulta.data.filter((s) => s.status === status).length,
  }))

  return (
    <section aria-labelledby="titulo-distribuicao" className="grid gap-4 rounded-2xl border border-border bg-surface p-5">
      <h3 id="titulo-distribuicao" className="font-sans text-base font-semibold">
        Solicitações de treinamento por status
      </h3>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma solicitação ainda.</p>
      ) : (
        <>
          <div aria-hidden="true" className="flex h-3 overflow-hidden rounded-full bg-surface-2">
            {contagens.map(({ status, quantidade }) =>
              quantidade > 0 ? (
                <span
                  key={status}
                  className={cn('h-full border-r-2 border-surface last:border-r-0', VISUAL_STATUS[status].cor)}
                  style={{ width: `${(quantidade / total) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <ul className="grid gap-2 sm:grid-cols-3" aria-label="Quantidade por status">
            {contagens.map(({ status, quantidade }) => (
              <li key={status} className="flex items-center gap-2 text-sm">
                <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-full', VISUAL_STATUS[status].cor)} />
                <span>
                  {VISUAL_STATUS[status].rotulo}:{' '}
                  <strong className="font-semibold tabular-nums">{formatarNumero(quantidade)}</strong>{' '}
                  <span className="text-muted-foreground">({formatarPercentual(quantidade / total)})</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** Visão geral do ADMIN: só totais e distribuição vindos das listas reais da API. */
export function PainelAdmin() {
  const colaboradores = useColaboradores()
  const cursos = useCursos()
  const treinamentos = useTreinamentos()

  return (
    <section aria-labelledby="titulo-panorama" className="grid gap-5">
      <h2 id="titulo-panorama" className="font-sans text-xl font-semibold">
        Panorama
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Indicador titulo="Colaboradores" caminho="/admin/colaboradores" icone={Users} consulta={colaboradores} />
        <Indicador titulo="Cursos" caminho="/cursos" icone={BookOpen} consulta={cursos} />
        <Indicador titulo="Solicitações de treinamento" caminho="/admin/treinamentos" icone={SquareActivity} consulta={treinamentos} />
      </div>
      <DistribuicaoTreinamentos consulta={treinamentos} />
    </section>
  )
}
