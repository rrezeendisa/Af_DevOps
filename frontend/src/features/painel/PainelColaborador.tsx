import { ArrowUpRight, ChartNoAxesCombined, ShieldCheck, ShieldOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { useAcessoIa } from '@/features/consentimento/acesso'
import { useJornada } from '@/features/ia/contextoJornada'
import { NivelCompetencia } from '@/features/ia/NivelCompetencia'
import { mensagemDeErro } from '@/lib/api/mensagens'
import { formatarDataHora } from '@/lib/formatacao'

function Cartao({ titulo, icone, children, acao }: { titulo: string; icone: ReactNode; children: ReactNode; acao: ReactNode }) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">{titulo}</h3>
        {icone}
      </div>
      <div className="flex-1">{children}</div>
      {acao}
    </section>
  )
}

const ESTILO_LINK =
  'inline-flex items-center gap-1 self-start rounded-sm text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring'

/** Situação real do colaborador individual: consentimento no servidor e classificação desta sessão. */
export function PainelColaborador() {
  const { acesso, consulta: consentimento } = useAcessoIa()
  const jornada = useJornada()
  const classificacao = acesso === 'liberado' ? jornada.classificacao : null
  const verificando = acesso === 'carregando' || acesso === 'indefinido'

  return (
    <section aria-labelledby="titulo-situacao" className="grid gap-5">
      <h2 id="titulo-situacao" className="font-sans text-xl font-semibold">
        Sua situação
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Cartao
          titulo="Uso da IA"
          icone={<ShieldCheck aria-hidden="true" className="size-4 text-brand-detail" strokeWidth={1.75} />}
          acao={
            <Link to="/consentimento" className={ESTILO_LINK}>
              Gerenciar consentimento
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          }
        >
          {verificando ? (
            <div role="status">
              <span className="sr-only">Consultando autorização…</span>
              <Skeleton aria-hidden="true" className="h-7 w-32 rounded-md bg-surface-2" />
            </div>
          ) : consentimento.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {mensagemDeErro(consentimento.error)}
            </p>
          ) : consentimento.data?.autorizado ? (
            <div className="grid gap-1">
              <p className="text-lg font-semibold">Autorizado</p>
              {consentimento.data.decididoEm && (
                <p className="text-sm text-muted-foreground">Desde {formatarDataHora(consentimento.data.decididoEm)}</p>
              )}
            </div>
          ) : (
            <div className="grid gap-1">
              <p className="flex items-center gap-2 text-lg font-semibold">
                <ShieldOff aria-hidden="true" className="size-4 text-muted-foreground" />
                Não autorizado
              </p>
              <p className="text-sm text-muted-foreground">Autorize para usar a avaliação, as recomendações e a orientação.</p>
            </div>
          )}
        </Cartao>

        <Cartao
          titulo="Sua classificação"
          icone={<ChartNoAxesCombined aria-hidden="true" className="size-4 text-brand-detail" strokeWidth={1.75} />}
          acao={
            <Link to="/competencias" className={ESTILO_LINK}>
              {classificacao ? 'Revisar avaliação' : 'Fazer a avaliação'}
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          }
        >
          {verificando ? (
            <p role="status" className="text-sm text-muted-foreground">Verificando sua autorização…</p>
          ) : acesso === 'erro' ? (
            <p className="text-sm text-muted-foreground">Classificação indisponível até confirmar sua autorização.</p>
          ) : classificacao ? (
            <div className="grid gap-2">
              <NivelCompetencia nivel={classificacao.nivel} compacto />
              <p className="text-xs text-muted-foreground">Estimativa desta sessão · modelo {classificacao.versaoModelo}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Você ainda não fez a avaliação nesta sessão.</p>
          )}
        </Cartao>
      </div>
    </section>
  )
}
