import { ArrowRight, ShieldCheck, ShieldOff } from 'lucide-react'
import { Link } from 'react-router'
import { MascoteEvolia } from '@/components/marca/MascoteEvolia'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAcessoIa } from '@/features/consentimento/acesso'
import { useJornada } from '@/features/ia/contextoJornada'
import { NivelCompetencia } from '@/features/ia/NivelCompetencia'
import { mensagemDeErro } from '@/lib/api/mensagens'
import { formatarDataHora } from '@/lib/formatacao'

const CARTAO = 'flex items-center gap-4 rounded-3xl border border-border bg-surface p-5 shadow-baixa sm:gap-6 sm:p-6'
const BOTAO = 'h-10 rounded-xl'

/** Orientador, autorização real do uso da IA e classificação desta sessão. Só conta individual. */
export function PainelColaborador() {
  const { acesso, consulta: consentimento } = useAcessoIa()
  const jornada = useJornada()
  const classificacao = acesso === 'liberado' ? jornada.classificacao : null
  const verificando = acesso === 'carregando' || acesso === 'indefinido'

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <section aria-label="Seu orientador IA" className={`${CARTAO} fundo-neon`}>
          <MascoteEvolia decorativo className="w-20 shrink-0 sm:w-28" />
          <div className="grid justify-items-start gap-2">
            <h2 className="text-xl font-semibold sm:text-2xl">Seu orientador IA</h2>
            <p className="text-sm text-muted-foreground">Encontre apoio para o seu desenvolvimento.</p>
            <Button asChild className={`${BOTAO} bg-accent text-accent-foreground hover:bg-secondary`}>
              <Link to="/orientacao">
                Abrir orientador
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>

        <section aria-label="Sua privacidade" className={`${CARTAO} fundo-neon`}>
          <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-3xl bg-lavagem-lilas text-brand-detail sm:size-24">
            <ShieldCheck className="size-8 sm:size-12" strokeWidth={1.5} />
          </span>
          <div className="grid justify-items-start gap-2">
            <h2 className="text-xl font-semibold sm:text-2xl">Sua privacidade</h2>
            <p className="text-sm text-muted-foreground">Você controla a autorização de uso da IA.</p>
            {verificando ? (
              <div role="status">
                <span className="sr-only">Consultando autorização…</span>
                <Skeleton aria-hidden="true" className="h-5 w-32 rounded-md bg-surface-2" />
              </div>
            ) : consentimento.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {mensagemDeErro(consentimento.error)}
              </p>
            ) : consentimento.data?.autorizado ? (
              <p className="flex flex-wrap items-center gap-x-2 text-sm">
                <ShieldCheck aria-hidden="true" className="size-4 text-success" />
                <strong className="font-semibold">Autorizado</strong>
                {consentimento.data.decididoEm && <span className="text-muted-foreground">Desde {formatarDataHora(consentimento.data.decididoEm)}</span>}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm">
                <ShieldOff aria-hidden="true" className="size-4 text-muted-foreground" />
                <strong className="font-semibold">Não autorizado</strong>
              </p>
            )}
            <Button asChild className={`${BOTAO} bg-lavagem-rosa text-foreground hover:bg-accent hover:text-accent-foreground`}>
              <Link to="/consentimento">
                Gerenciar autorização
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </div>

      <section aria-label="Sua classificação" className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-border bg-surface px-5 py-4">
        <h2 className="font-sans text-sm font-semibold">Sua classificação</h2>
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          {verificando ? (
            <p role="status" className="text-sm text-muted-foreground">Verificando sua autorização…</p>
          ) : acesso === 'erro' ? (
            <p className="text-sm text-muted-foreground">Classificação indisponível até confirmar sua autorização.</p>
          ) : classificacao ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <NivelCompetencia nivel={classificacao.nivel} compacto />
              <p className="text-xs text-muted-foreground">Estimativa desta sessão · modelo {classificacao.versaoModelo}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Você ainda não fez a avaliação nesta sessão.</p>
          )}
        </div>
        <Link to="/competencias" className="rounded-sm text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
          {classificacao ? 'Revisar avaliação' : 'Fazer a avaliação'}
        </Link>
      </section>
    </div>
  )
}
