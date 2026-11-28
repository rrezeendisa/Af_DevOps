import { LoaderCircle, MessageSquareText, Send, Sparkles } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { BadgeStatus } from '@/components/feedback/BadgeStatus'
import { EstadoVazio } from '@/components/feedback/EstadoVazio'
import { MensagemErro } from '@/components/feedback/MensagemErro'
import { Campo } from '@/components/formulario/Campo'
import { CabecalhoPagina } from '@/components/layout/CabecalhoPagina'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ExigeConsentimento } from '@/features/consentimento/ExigeConsentimento'
import { contarCaracteres, LIMITE_PERGUNTA, problemaNaPergunta } from './api'
import { useJornada } from './contextoJornada'
import { ListaFontes } from './ListaFontes'

function Resultado() {
  const { orientacao } = useJornada()
  if (!orientacao) return null
  const { pergunta, resposta } = orientacao
  // Tudo é exibido como texto: o React escapa o conteúdo e nada é interpretado como HTML.
  return (
    <section aria-labelledby="titulo-orientacao" className="grid gap-5">
      <div className="grid gap-4 rounded-2xl border border-border bg-surface p-6">
        <h2 id="titulo-orientacao" className="font-sans text-lg font-semibold">
          Orientação
        </h2>
        <p className="text-sm text-muted-foreground">
          Sua pergunta: <span className="text-foreground">{pergunta}</span>
        </p>
        <p className="text-base whitespace-pre-line">{resposta.orientacao}</p>
      </div>

      <section aria-labelledby="titulo-proximos" className="grid gap-3 rounded-2xl bg-accent p-6 text-accent-foreground dark:border dark:border-accent/30 dark:bg-surface-2 dark:text-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="titulo-proximos" className="font-sans text-base font-semibold">
            Próximos passos sugeridos
          </h2>
          {resposta.proximosPassos && (
            <BadgeStatus tom="rosa" icone={Sparkles}>
              Gerado por IA
            </BadgeStatus>
          )}
        </div>
        {resposta.proximosPassos ? (
          <ol className="grid list-decimal gap-1.5 pl-5 text-sm">
            {resposta.proximosPassos.map((passo, indice) => (
              <li key={indice}>{passo}</li>
            ))}
          </ol>
        ) : (
          <p className="text-sm">Próximos passos complementares não estão disponíveis agora. A orientação acima continua válida.</p>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="Cursos citados" className="grid content-start gap-3 rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-sans text-base font-semibold">Cursos citados</h2>
          {resposta.cursosRecomendados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum curso citado nesta orientação.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {resposta.cursosRecomendados.map((codigo, indice) => (
                <li key={`${codigo}-${indice}`}>
                  <code className="rounded-md bg-surface-2 px-2 py-1 font-mono text-xs">{codigo}</code>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">Códigos do acervo de documentos da IA.</p>
        </section>
        <ListaFontes fontes={resposta.fontes} />
      </div>
    </section>
  )
}

function Orientacao() {
  const { competenciasCompletas, orientar, cancelar, pendente, falha, aviso } = useJornada()
  const [pergunta, setPergunta] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const idContador = useId()

  if (!competenciasCompletas) {
    return (
      <EstadoVazio
        icone={MessageSquareText}
        titulo="Faça a avaliação primeiro"
        descricao="A orientação usa as notas da sua avaliação nesta sessão."
        acao={
          <Button asChild variant="secondary">
            <Link to="/competencias">Fazer a avaliação</Link>
          </Button>
        }
      />
    )
  }

  const total = contarCaracteres(pergunta.trim())

  return (
    <div className="grid gap-6">
      <form
        noValidate
        className="grid gap-4 rounded-2xl border border-border bg-surface p-6"
        onSubmit={(evento) => {
          evento.preventDefault()
          if (pendente.orientacao) return
          const problema = problemaNaPergunta(pergunta)
          setErro(problema)
          if (!problema) void orientar(pergunta.trim())
        }}
      >
        <Campo rotulo="Sua pergunta" erro={erro ?? undefined} ajuda={<span id={idContador}>{total}/{LIMITE_PERGUNTA} caracteres</span>}>
          <Textarea
            rows={4}
            value={pergunta}
            onChange={(evento) => setPergunta(evento.target.value)}
            placeholder="Ex.: Por onde começo para melhorar em tecnologia?"
          />
        </Campo>
        <Button type="submit" className="justify-self-start" disabled={pendente.orientacao}>
          <Send aria-hidden="true" />
          Pedir orientação
        </Button>
      </form>

      {pendente.orientacao && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface-2 p-5">
          <div className="flex items-start gap-3">
            <LoaderCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 animate-spin text-brand-detail" />
            <div className="grid gap-0.5 text-sm">
              <p className="font-semibold">A IA está preparando sua orientação.</p>
              <p className="text-muted-foreground">Isso pode levar até 90 segundos.</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => cancelar('orientacao')}>
            Cancelar espera
          </Button>
        </div>
      )}

      {aviso === 'orientacao-cancelada' && (
        <MensagemErro tom="aviso" titulo="Espera cancelada">
          A espera foi interrompida nesta tela. O processamento pode continuar no servidor, mas o resultado não será exibido.
        </MensagemErro>
      )}

      {falha.orientacao && (
        <MensagemErro titulo="Não foi possível obter a orientação">{falha.orientacao} Você pode enviar a pergunta novamente.</MensagemErro>
      )}

      {!pendente.orientacao && <Resultado />}
    </div>
  )
}

export default function PaginaOrientacao() {
  return (
    <div className="grid gap-8 pt-2">
      <CabecalhoPagina
        titulo="Orientação com IA"
        descricao="Faça uma pergunta sobre seu desenvolvimento. A resposta considera as notas da sua avaliação."
      />
      <ExigeConsentimento>
        <Orientacao />
      </ExigeConsentimento>
    </div>
  )
}
