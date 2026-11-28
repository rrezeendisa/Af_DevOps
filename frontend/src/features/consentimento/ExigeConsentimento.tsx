import { ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ErroConsulta } from '@/components/feedback/ErroConsulta'
import { EstadoCarregando } from '@/components/feedback/EstadoCarregando'
import { MensagemErro } from '@/components/feedback/MensagemErro'
import { Button } from '@/components/ui/button'
import { useJornada } from '@/features/ia/contextoJornada'
import { useAcessoIa } from './acesso'

export const TEXTO_DESCARTE =
  'Os resultados de IA desta sessão foram descartados nesta tela. Solicitações já enviadas podem ter sido processadas pelo servidor.'

/** Avisos da jornada ligados ao consentimento. */
export function AvisoDescarte() {
  const { aviso } = useJornada()
  if (aviso === 'revogado') {
    return (
      <MensagemErro tom="aviso" titulo="Resultados descartados">
        {TEXTO_DESCARTE}
      </MensagemErro>
    )
  }
  if (aviso === 'consentimento-necessario') {
    return (
      <MensagemErro titulo="Autorização necessária">
        O servidor não encontrou uma autorização válida para o uso da IA. {TEXTO_DESCARTE}
      </MensagemErro>
    )
  }
  return null
}

/** Mostra o conteúdo só quando o uso da IA está confirmado; caso contrário, explica e bloqueia. */
export function ExigeConsentimento({ children }: { children: ReactNode }) {
  const { acesso, consulta } = useAcessoIa()

  if (acesso === 'carregando' || acesso === 'indefinido') {
    return <EstadoCarregando texto="Verificando sua autorização para o uso da IA…" />
  }
  if (acesso === 'erro') {
    return (
      <ErroConsulta
        erro={consulta.error}
        titulo="Não foi possível verificar sua autorização"
        aoTentarNovamente={() => void consulta.refetch()}
      />
    )
  }
  if (acesso === 'liberado') {
    return <>{children}</>
  }
  return (
    <div className="grid gap-4">
      <AvisoDescarte />
      <section className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-surface p-6 sm:flex-row sm:items-center">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <ShieldAlert aria-hidden="true" className="size-5" />
        </span>
        <div className="grid flex-1 gap-1">
          <h2 className="font-sans text-lg font-semibold">Autorização necessária</h2>
          <p className="text-sm text-muted-foreground">
            Para usar a avaliação, as recomendações e a orientação, autorize o uso dos seus dados pela IA.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link to="/consentimento">Revisar consentimento</Link>
        </Button>
      </section>
    </div>
  )
}
