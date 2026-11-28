import { Check, ShieldCheck, ShieldOff } from 'lucide-react'
import { useState } from 'react'
import { BadgeStatus } from '@/components/feedback/BadgeStatus'
import { ErroConsulta } from '@/components/feedback/ErroConsulta'
import { EstadoCarregando } from '@/components/feedback/EstadoCarregando'
import { MensagemErro } from '@/components/feedback/MensagemErro'
import { CabecalhoPagina } from '@/components/layout/CabecalhoPagina'
import { Button } from '@/components/ui/button'
import { useJornada } from '@/features/ia/contextoJornada'
import { ehApiError } from '@/lib/api/erros'
import { mensagemDeErro } from '@/lib/api/mensagens'
import { formatarDataHora } from '@/lib/formatacao'
import { useConsentimento, useDecidirConsentimento, type Consentimento } from './api'
import { AvisoDescarte } from './ExigeConsentimento'

type Retorno = { tom: 'sucesso' | 'erro'; titulo: string; texto: string }

function EstadoAtual({ consentimento }: { consentimento: Consentimento }) {
  const { autorizado, decididoEm } = consentimento
  return (
    <div className="flex flex-wrap items-center gap-3">
      {autorizado ? (
        <BadgeStatus tom="destaque" icone={ShieldCheck}>
          Autorizado
        </BadgeStatus>
      ) : (
        <BadgeStatus tom="neutro" icone={ShieldOff}>
          Não autorizado
        </BadgeStatus>
      )}
      <p className="text-sm text-muted-foreground">
        {decididoEm === null
          ? 'Você ainda não registrou uma decisão.'
          : `${autorizado ? 'Autorização registrada' : 'Decisão registrada'} em ${formatarDataHora(decididoEm)}.`}
      </p>
    </div>
  )
}

export default function PaginaConsentimento() {
  const consulta = useConsentimento()
  const decidir = useDecidirConsentimento()
  const jornada = useJornada()
  const [confirmandoRevogacao, setConfirmandoRevogacao] = useState(false)
  const [retorno, setRetorno] = useState<Retorno | null>(null)

  /**
   * Envia a decisão e só então consulta o estado real. Antes do PUT, a IA é bloqueada (e, na
   * revogação, a jornada local é descartada e as requisições abortadas). A rotina da decisão
   * permanece pendente até concluir a releitura do servidor.
   */
  const enviarDecisao = async (autorizado: boolean) => {
    if (decidir.isPending) return
    setRetorno(null)
    if (!autorizado) {
      jornada.descartar('revogado')
    }
    try {
      const resultado = await decidir.mutateAsync(autorizado)
      setRetorno(
        resultado.autorizado
          ? { tom: 'sucesso', titulo: 'Uso da IA autorizado', texto: 'O servidor confirmou sua decisão.' }
          : { tom: 'sucesso', titulo: 'Autorização revogada', texto: 'O servidor confirmou a revogação. Novas solicitações de IA serão recusadas.' },
      )
    } catch (erro) {
      if (ehApiError(erro) && erro.tipo === 'cancelado') return
      setRetorno({
        tom: 'erro',
        titulo: autorizado ? 'Não foi possível registrar a autorização' : 'Não foi possível registrar a revogação',
        texto: mensagemDeErro(erro),
      })
    } finally {
      setConfirmandoRevogacao(false)
    }
  }

  // Só a decisão em envio bloqueia os botões; uma releitura em segundo plano não deve engolir o clique.
  const ocupado = decidir.isPending

  return (
    <div className="grid gap-8 pt-2">
      <CabecalhoPagina
        titulo="Consentimento"
        descricao="Decida se a Evolia pode usar suas notas de competências nas funcionalidades de inteligência artificial."
      />

      {retorno && (
        <MensagemErro tom={retorno.tom} titulo={retorno.titulo}>
          {retorno.texto}
        </MensagemErro>
      )}
      {!retorno && <AvisoDescarte />}

      <section aria-labelledby="titulo-estado" className="grid gap-5 rounded-2xl border border-border bg-surface p-6">
        <h2 id="titulo-estado" className="font-sans text-lg font-semibold">
          Sua decisão atual
        </h2>
        {decidir.isPending ? (
          <EstadoCarregando texto="Enviando sua decisão ao servidor…" linhas={1} />
        ) : consulta.isPending ? (
          <EstadoCarregando texto="Consultando sua decisão…" linhas={1} />
        ) : consulta.isError ? (
          <ErroConsulta erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
        ) : (
          <>
            <EstadoAtual consentimento={consulta.data} />
            {consulta.data.autorizado ? (
              confirmandoRevogacao ? (
                <div className="grid gap-4 rounded-xl bg-surface-2 p-5" role="group" aria-labelledby="titulo-confirmar">
                  <p id="titulo-confirmar" className="font-semibold">
                    Revogar a autorização?
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ao confirmar, as notas e os resultados de IA desta sessão serão descartados e as solicitações em
                    andamento deixarão de ser aguardadas. Solicitações já enviadas podem ter sido processadas pelo servidor.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="destructive" disabled={ocupado} onClick={() => void enviarDecisao(false)}>
                      Confirmar revogação
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmandoRevogacao(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" className="justify-self-start" disabled={ocupado} onClick={() => setConfirmandoRevogacao(true)}>
                  <ShieldOff aria-hidden="true" />
                  Revogar autorização
                </Button>
              )
            ) : (
              <Button className="justify-self-start" disabled={ocupado} onClick={() => void enviarDecisao(true)}>
                <ShieldCheck aria-hidden="true" />
                Autorizar uso da IA
              </Button>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="titulo-uso" className="grid gap-6 lg:grid-cols-2">
        <div className="grid content-start gap-3 rounded-2xl bg-surface-2 p-6">
          <h2 id="titulo-uso" className="font-sans text-lg font-semibold">
            O que depende da autorização
          </h2>
          <ul className="grid gap-2 text-sm">
            {['Avaliação e classificação de competências', 'Recomendações de cursos com justificativas', 'Orientação com IA'].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-detail" />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">O catálogo de cursos continua disponível sem autorização.</p>
        </div>
        <div className="grid content-start gap-3 rounded-2xl border border-border bg-surface p-6 text-sm text-muted-foreground">
          <h2 className="font-sans text-lg font-semibold text-foreground">Como funciona</h2>
          <p>A autorização nunca é concedida automaticamente. Você pode revogá-la a qualquer momento.</p>
          <p>O servidor verifica sua decisão antes de cada solicitação de IA. O registro representa sua decisão atual, não um histórico.</p>
          <p>
            Ao revogar, os resultados desta sessão são descartados nesta tela. Solicitações já enviadas podem ter
            sido processadas pelo servidor.
          </p>
        </div>
      </section>
    </div>
  )
}
