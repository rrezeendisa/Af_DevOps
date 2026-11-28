import { ArrowLeft, SearchX } from 'lucide-react'
import { Link } from 'react-router'
import { ErroConsulta } from '@/components/feedback/ErroConsulta'
import { EstadoCarregando } from '@/components/feedback/EstadoCarregando'
import { EstadoVazio } from '@/components/feedback/EstadoVazio'
import { CabecalhoPagina } from '@/components/layout/CabecalhoPagina'
import { Button } from '@/components/ui/button'
import { ehNaoEncontrado } from '@/lib/api/mensagens'
import { formatarDataHora } from '@/lib/formatacao'
import { useTreinamento } from './api'
import { BadgeStatusTreinamento } from './BadgeStatusTreinamento'

function Voltar() {
  return (
    <Button asChild variant="ghost" className="justify-self-start px-2">
      <Link to="/admin/treinamentos">
        <ArrowLeft aria-hidden="true" />
        Voltar aos treinamentos
      </Link>
    </Button>
  )
}

export default function PaginaTreinamento({ id }: { id: number }) {
  const consulta = useTreinamento(id)

  if (consulta.isPending) {
    return <EstadoCarregando texto="Carregando solicitação…" />
  }
  if (consulta.isError) {
    return (
      <div className="grid gap-6 pt-2">
        <Voltar />
        {ehNaoEncontrado(consulta.error) ? (
          <EstadoVazio icone={SearchX} titulo="Solicitação não encontrada" descricao="Confira o número ou volte à lista." />
        ) : (
          <ErroConsulta erro={consulta.error} titulo="Não foi possível carregar a solicitação" aoTentarNovamente={() => void consulta.refetch()} />
        )}
      </div>
    )
  }

  const s = consulta.data
  return (
    <div className="grid gap-8 pt-2">
      <Voltar />
      <CabecalhoPagina
        titulo={`Solicitação nº ${s.id}`}
        selo={<BadgeStatusTreinamento status={s.status} />}
        descricao={s.status === 'PENDENTE' ? 'Aguardando o worker de treinamento. Esta página se atualiza automaticamente.' : undefined}
      />
      <dl className="grid gap-5 rounded-3xl border border-border bg-surface shadow-baixa p-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">Solicitada por</dt>
          <dd className="mt-0.5 font-semibold">{s.solicitadoPor}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Versão do modelo</dt>
          <dd className="mt-0.5 font-semibold">{s.versaoModelo ?? 'Ainda não informada'}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Criada em</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{formatarDataHora(s.criadoEm)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Atualizada em</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{formatarDataHora(s.atualizadoEm)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm text-muted-foreground">Mensagem do worker</dt>
          <dd className="mt-0.5 whitespace-pre-line">{s.mensagem ?? 'Ainda não informada'}</dd>
        </div>
      </dl>
    </div>
  )
}
