import { BookOpen, BookPlus, ChevronRight, Layers, ListChecks, RotateCw, Sparkle, UserPlus, Users, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { useColaboradores } from '@/features/colaboradores/api'
import { useCursos } from '@/features/cursos/api'
import { STATUS_TREINAMENTO, useTreinamentos, type StatusTreinamento } from '@/features/treinamentos/api'
import { BadgeStatusTreinamento } from '@/features/treinamentos/BadgeStatusTreinamento'
import { mensagemDeErro } from '@/lib/api/mensagens'
import { formatarDataHora, formatarNumero } from '@/lib/formatacao'
import { cn } from '@/lib/utils'

const FOCO = 'rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'
const PAINEL = 'min-w-0 rounded-3xl border border-border bg-surface p-4 shadow-baixa sm:p-6'

type ConsultaLista = {
  isPending: boolean
  isError: boolean
  error: unknown
  data: readonly unknown[] | undefined
  refetch: () => unknown
}

function TentarNovamente({ erro, aoTentar }: { erro: unknown; aoTentar: () => unknown }) {
  return (
    <div className="grid justify-items-start gap-2" role="alert">
      <p className="text-sm text-destructive">{mensagemDeErro(erro)}</p>
      <button
        type="button"
        onClick={() => void aoTentar()}
        className={cn('relative z-10 inline-flex items-center gap-1.5 text-sm font-semibold underline decoration-primary decoration-2 underline-offset-4', FOCO)}
      >
        <RotateCw aria-hidden="true" className="size-3.5" />
        Tentar novamente
      </button>
    </div>
  )
}

type PropsIndicador = { titulo: string; rotuloDoLink: string; caminho: string; icone: LucideIcon; tom: string; consulta: ConsultaLista }

/** Total vindo da lista real. Erro nunca vira zero. */
function Indicador({ titulo, rotuloDoLink, caminho, icone: Icone, tom, consulta }: PropsIndicador) {
  return (
    <div className="relative flex items-center gap-4 rounded-3xl border border-border bg-surface p-5 shadow-baixa transition-[translate,box-shadow] duration-300 hover:shadow-media motion-safe:hover:-translate-y-0.5">
      <span aria-hidden="true" className={cn('flex size-14 shrink-0 items-center justify-center rounded-2xl text-brand-detail', tom)}>
        <Icone className="size-6" strokeWidth={1.75} />
      </span>
      <div className="grid min-w-0 gap-1">
        <h3 className="font-sans text-sm font-medium">
          <Link to={caminho} aria-label={rotuloDoLink} className={cn('underline-offset-4 after:absolute after:inset-0 hover:underline', FOCO)}>
            {titulo}
          </Link>
        </h3>
        {consulta.isPending ? (
          <div role="status">
            <span className="sr-only">Carregando {titulo.toLowerCase()}…</span>
            <Skeleton aria-hidden="true" className="h-9 w-16 rounded-md bg-surface-2" />
          </div>
        ) : consulta.isError ? (
          <TentarNovamente erro={consulta.error} aoTentar={consulta.refetch} />
        ) : (
          <p className="text-3xl font-semibold tracking-[-0.02em] tabular-nums" data-testid={`total-${caminho}`}>
            {formatarNumero(consulta.data?.length ?? 0)}
          </p>
        )}
      </div>
    </div>
  )
}

const ROTULO_CONTAGEM: Record<StatusTreinamento, string> = { PENDENTE: 'Pendentes', CONCLUIDO: 'Concluídas', FALHOU: 'Com falha' }
const LINHAS = 5

/** Solicitações reais mais recentes. A atualização periódica vem de `useTreinamentos`. */
function Treinamentos({ consulta }: { consulta: ReturnType<typeof useTreinamentos> }) {
  const recentes = consulta.data ? [...consulta.data].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm) || b.id - a.id).slice(0, LINHAS) : []

  return (
    <section aria-labelledby="titulo-treinamentos-inicio" className={cn(PAINEL, 'grid content-start gap-4')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titulo-treinamentos-inicio" className="text-2xl font-semibold">
          Treinamentos da IA
        </h2>
        <Link to="/admin/treinamentos" className={cn('text-sm font-medium underline-offset-4 hover:underline', FOCO)}>
          Ver todos os treinamentos
        </Link>
      </div>
      {consulta.isPending ? (
        <div role="status">
          <span className="sr-only">Carregando solicitações…</span>
          <Skeleton aria-hidden="true" className="h-32 w-full rounded-xl bg-surface-2" />
        </div>
      ) : consulta.isError ? (
        <TentarNovamente erro={consulta.error} aoTentar={consulta.refetch} />
      ) : recentes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma solicitação ainda.</p>
      ) : (
        <>
          <ul aria-label="Quantidade por status" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {STATUS_TREINAMENTO.map((status) => (
              <li key={status}>
                {ROTULO_CONTAGEM[status]}:{' '}
                <strong className="font-semibold text-foreground tabular-nums">{formatarNumero(consulta.data.filter((s) => s.status === status).length)}</strong>
              </li>
            ))}
          </ul>
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Solicitações de treinamento mais recentes</caption>
            <thead>
              <tr className="bg-lavagem-lilas">
                <th scope="col" className="rounded-l-xl px-2 py-2.5 font-medium sm:px-4">Solicitação</th>
                <th scope="col" className="px-2 py-2.5 font-medium sm:px-4">Data</th>
                <th scope="col" className="rounded-r-xl px-2 py-2.5 font-medium sm:px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentes.map((solicitacao) => (
                <tr key={solicitacao.id}>
                  <th scope="row" className="px-2 py-3 font-normal sm:px-4">
                    <Link to={`/admin/treinamentos/${solicitacao.id}`} className={cn('font-medium underline-offset-4 hover:underline', FOCO)}>
                      #{solicitacao.id}
                    </Link>
                  </th>
                  <td className="px-2 py-3 text-muted-foreground sm:px-4">{formatarDataHora(solicitacao.criadoEm)}</td>
                  <td className="px-2 py-3 sm:px-4">
                    <BadgeStatusTreinamento status={solicitacao.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}

/** Atalhos: só navegam. O cadastro abre na própria página; o treinamento é pedido lá, pelo botão. */
const ACOES = [
  { rotulo: 'Cadastrar colaborador', caminho: '/admin/colaboradores', icone: UserPlus, abrirCadastro: true },
  { rotulo: 'Cadastrar curso', caminho: '/cursos', icone: BookPlus, abrirCadastro: true },
  { rotulo: 'Solicitar treinamento', caminho: '/admin/treinamentos', icone: Sparkle, abrirCadastro: false },
  { rotulo: 'Consultar treinamentos', caminho: '/admin/treinamentos', icone: ListChecks, abrirCadastro: false },
] as const

function AcoesRapidas() {
  return (
    <section aria-labelledby="titulo-acoes" className={cn(PAINEL, 'grid content-start gap-3')}>
      <h2 id="titulo-acoes" className="text-2xl font-semibold">
        Ações rápidas
      </h2>
      <ul className="grid gap-2">
        {ACOES.map(({ rotulo, caminho, icone: Icone, abrirCadastro }) => (
          <li key={rotulo}>
            <Link
              to={caminho}
              state={abrirCadastro ? { abrirCadastro: true } : null}
              className="flex min-h-12 items-center gap-3 rounded-xl bg-lavagem-lilas px-4 text-sm font-medium transition-colors outline-none hover:bg-selected focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icone aria-hidden="true" className="size-5 shrink-0 text-brand-detail" strokeWidth={1.75} />
              <span className="flex-1">{rotulo}</span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-brand-detail" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Painel do ADMIN: só dados das listas reais da API. */
export function PainelAdmin() {
  const colaboradores = useColaboradores()
  const cursos = useCursos()
  const treinamentos = useTreinamentos()

  return (
    <div className="grid gap-4">
      <section aria-labelledby="titulo-panorama" className="grid gap-4 md:grid-cols-3">
        <h2 id="titulo-panorama" className="sr-only">
          Panorama
        </h2>
        <Indicador titulo="Colaboradores" rotuloDoLink="Abrir colaboradores" caminho="/admin/colaboradores" icone={Users} tom="bg-lavagem-lilas" consulta={colaboradores} />
        <Indicador titulo="Cursos cadastrados" rotuloDoLink="Abrir cursos cadastrados" caminho="/cursos" icone={BookOpen} tom="bg-lavagem-rosa" consulta={cursos} />
        <Indicador titulo="Treinamentos" rotuloDoLink="Abrir treinamentos" caminho="/admin/treinamentos" icone={Layers} tom="bg-lavagem-lima" consulta={treinamentos} />
      </section>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Treinamentos consulta={treinamentos} />
        <AcoesRapidas />
      </div>
    </div>
  )
}
