import { RefreshCw, SquareActivity } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ErroConsulta } from '@/components/feedback/ErroConsulta'
import { EstadoCarregando } from '@/components/feedback/EstadoCarregando'
import { EstadoVazio } from '@/components/feedback/EstadoVazio'
import { MensagemErro } from '@/components/feedback/MensagemErro'
import { CabecalhoPagina } from '@/components/layout/CabecalhoPagina'
import { Button } from '@/components/ui/button'
import { ehApiError } from '@/lib/api/erros'
import { mensagemDeErro } from '@/lib/api/mensagens'
import { formatarDataHora } from '@/lib/formatacao'
import { temPendente, useSolicitarTreinamento, useTreinamentos } from './api'
import { BadgeStatusTreinamento } from './BadgeStatusTreinamento'

type Retorno = { tom: 'sucesso' | 'erro'; titulo: string; texto: string }

const RESUMO = [
  { status: 'PENDENTE', rotulo: 'Pendentes', tom: 'bg-lavagem-lilas' },
  { status: 'CONCLUIDO', rotulo: 'Concluídas', tom: 'bg-lavagem-lima' },
  { status: 'FALHOU', rotulo: 'Com falha', tom: 'bg-lavagem-rosa' },
] as const

export default function PaginaTreinamentos() {
  const consulta = useTreinamentos()
  const solicitar = useSolicitarTreinamento()
  const [retorno, setRetorno] = useState<Retorno | null>(null)

  const solicitacoes = useMemo(() => [...(consulta.data ?? [])].sort((a, b) => b.id - a.id), [consulta.data])
  const atualizando = temPendente(consulta.data)

  const aoSolicitar = async () => {
    if (solicitar.isPending) {
      return
    }
    setRetorno(null)
    try {
      const criada = await solicitar.mutateAsync()
      setRetorno({ tom: 'sucesso', titulo: 'Solicitação registrada', texto: `A solicitação nº ${criada.id} foi registrada como pendente.` })
    } catch (erro) {
      if (ehApiError(erro) && erro.tipo === 'cancelado') return
      setRetorno({ tom: 'erro', titulo: 'Não foi possível solicitar o treinamento', texto: mensagemDeErro(erro) })
    }
  }

  return (
    <div className="grid gap-8 pt-2">
      <CabecalhoPagina
        titulo="Treinamentos"
        descricao="Solicitação e acompanhamento de treinamentos do modelo de classificação."
        acoes={
          <Button onClick={() => void aoSolicitar()} disabled={solicitar.isPending}>
            <RefreshCw aria-hidden="true" />
            {solicitar.isPending ? 'Solicitando…' : 'Solicitar retreinamento'}
          </Button>
        }
      />

      {retorno && (
        <MensagemErro tom={retorno.tom} titulo={retorno.titulo}>
          {retorno.texto}
        </MensagemErro>
      )}

      {consulta.isPending ? (
        <EstadoCarregando texto="Carregando solicitações…" />
      ) : consulta.isError ? (
        <ErroConsulta erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
      ) : solicitacoes.length === 0 ? (
        <EstadoVazio
          icone={SquareActivity}
          titulo="Nenhuma solicitação ainda"
          descricao="Solicite um retreinamento para atualizar o modelo de classificação."
        />
      ) : (
        <section aria-labelledby="titulo-solicitacoes" className="grid gap-3">
          {/* Contagens derivadas somente da lista recebida. */}
          <ul aria-label="Resumo por status" className="grid gap-3 sm:grid-cols-3">
            {RESUMO.map(({ status, rotulo, tom }) => (
              <li key={status} className={`flex items-baseline justify-between gap-3 rounded-2xl border border-border px-5 py-4 ${tom}`}>
                <span className="text-sm font-medium">{rotulo}</span>
                <strong className="text-2xl font-semibold tabular-nums">{solicitacoes.filter((s) => s.status === status).length}</strong>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="titulo-solicitacoes" className="font-sans text-lg font-semibold">
              Solicitações
            </h2>
            {atualizando && (
              <p className="text-sm text-muted-foreground" data-testid="indicador-polling">
                Atualizando automaticamente enquanto houver solicitações pendentes.
              </p>
            )}
          </div>
          <div className="overflow-x-auto rounded-3xl border border-border bg-surface shadow-baixa">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <caption className="sr-only">Solicitações de treinamento, da mais recente para a mais antiga</caption>
              <thead className="border-b border-border bg-lavagem-lilas text-xs tracking-[0.04em] text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Nº</th>
                  <th scope="col" className="px-5 py-3 font-medium">Status</th>
                  <th scope="col" className="px-5 py-3 font-medium">Solicitada por</th>
                  <th scope="col" className="px-5 py-3 font-medium">Versão do modelo</th>
                  <th scope="col" className="px-5 py-3 font-medium">Mensagem</th>
                  <th scope="col" className="px-5 py-3 font-medium">Criada em</th>
                  <th scope="col" className="px-5 py-3 font-medium">Atualizada em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {solicitacoes.map((s) => (
                  <tr key={s.id} className="align-top hover:bg-surface-2/60">
                    <th scope="row" className="px-5 py-3.5 font-semibold tabular-nums">
                      <Link
                        to={`/admin/treinamentos/${s.id}`}
                        aria-label={`Solicitação nº ${s.id}`}
                        className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {s.id}
                      </Link>
                    </th>
                    <td className="px-5 py-3.5">
                      <BadgeStatusTreinamento status={s.status} />
                    </td>
                    <td className="px-5 py-3.5">{s.solicitadoPor}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{s.versaoModelo ?? '—'}</td>
                    <td className="max-w-[18rem] px-5 py-3.5 text-muted-foreground">
                      <span className="line-clamp-2">{s.mensagem ?? '—'}</span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground tabular-nums">{formatarDataHora(s.criadoEm)}</td>
                    <td className="px-5 py-3.5 text-muted-foreground tabular-nums">{formatarDataHora(s.atualizadoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
