import { ArrowUp, ChartNoAxesColumn, Code2, LoaderCircle, MessageCircle, Zap } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { EstadoVazio } from '@/components/feedback/EstadoVazio'
import { MensagemErro } from '@/components/feedback/MensagemErro'
import { MascoteEvolia } from '@/components/marca/MascoteEvolia'
import { Button } from '@/components/ui/button'
import { ExigeConsentimento } from '@/features/consentimento/ExigeConsentimento'
import { cn } from '@/lib/utils'
import { contarCaracteres, LIMITE_PERGUNTA, problemaNaPergunta } from './api'
import { useJornada } from './contextoJornada'
import { Pergunta, Resposta } from './RespostaOrientador'

const SUGESTOES = [
  { texto: 'Como desenvolver minhas habilidades em tecnologia?', icone: Code2 },
  { texto: 'Como posso melhorar minha comunicação?', icone: MessageCircle },
  { texto: 'Quais competências devo desenvolver primeiro?', icone: Zap },
] as const

/** Boas-vindas, enquanto não há conversa. Não mostra dado nenhum da jornada. */
function Abertura() {
  return (
    <div className="grid justify-items-center gap-2 text-center sm:gap-3">
      <MascoteEvolia decorativo className="w-24 sm:w-40" />
      <h1 className="text-3xl font-semibold sm:text-4xl">Como posso ajudar você?</h1>
      <p className="max-w-md text-base text-muted-foreground sm:text-lg">Vamos encontrar seu próximo passo de desenvolvimento.</p>
    </div>
  )
}

function Orientacao() {
  const { competenciasCompletas, orientacao, perguntaEnviada: enviada, orientar, cancelar, pendente, falha, aviso } = useJornada()
  const interrompida = !pendente.orientacao && (aviso === 'orientacao-cancelada' || Boolean(falha.orientacao))
  // Em erro ou cancelamento o campo traz a pergunta de volta, mesmo depois de trocar de tela.
  const [pergunta, setPergunta] = useState(() => (interrompida ? (enviada ?? '') : ''))
  const [erro, setErro] = useState<string | null>(null)
  const campoRef = useRef<HTMLTextAreaElement>(null)
  const idCampo = useId()
  const idContador = useId()
  const idErro = useId()

  // Quando a resposta chega, só a pergunta respondida sai do campo; um rascunho novo fica.
  const [respondida, setRespondida] = useState(orientacao)
  if (orientacao !== respondida) {
    setRespondida(orientacao)
    if (orientacao && pergunta.trim() === orientacao.pergunta) setPergunta('')
  }
  const [estavaInterrompida, setEstavaInterrompida] = useState(interrompida)
  if (interrompida !== estavaInterrompida) {
    setEstavaInterrompida(interrompida)
    if (interrompida && pergunta === '' && enviada) setPergunta(enviada)
  }

  if (!competenciasCompletas) {
    return (
      <EstadoVazio
        icone={ChartNoAxesColumn}
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
  // Uma pergunta por vez: cada uma é independente, sem histórico.
  const emAndamento = (pendente.orientacao || interrompida) && enviada !== null
  const conversando = pendente.orientacao || emAndamento || orientacao !== null

  const enviar = () => {
    if (pendente.orientacao) return
    const problema = problemaNaPergunta(pergunta)
    setErro(problema)
    if (problema) return
    void orientar(pergunta.trim())
  }

  return (
    <div className={cn('flex flex-col gap-6', conversando && 'flex-1')}>
      {conversando && (
        <div className="grid gap-6">
          <h1 className="sr-only">Conversa com o orientador</h1>
          {emAndamento ? (
            <Pergunta texto={enviada} />
          ) : (
            !pendente.orientacao && orientacao && (
              <>
                <Pergunta texto={orientacao.pergunta} />
                <Resposta resposta={orientacao.resposta} />
              </>
            )
          )}
        </div>
      )}

      {/* Região fixa: é ela que anuncia a chegada da resposta a leitores de tela. */}
      <p role="status" className="sr-only">
        {!pendente.orientacao && !interrompida && orientacao ? 'Resposta do orientador recebida.' : ''}
      </p>

      {pendente.orientacao && (
        <div role="status" className="flex flex-wrap items-center gap-4">
          <MascoteEvolia pose="pensativo" decorativo className="w-16 shrink-0" />
          <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <LoaderCircle aria-hidden="true" className="size-4 shrink-0 text-brand-detail motion-safe:animate-spin" />
              A IA está preparando sua orientação.
            </p>
            <p className="text-muted-foreground">Isso pode levar até 90 segundos.</p>
          </div>
          <Button variant="outline" className="rounded-full" onClick={() => cancelar('orientacao')}>
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

      {!conversando && (
        <ul aria-label="Sugestões de perguntas" className="grid gap-3 sm:grid-cols-3">
          {SUGESTOES.map(({ texto, icone: Icone }) => (
            <li key={texto}>
              <button
                type="button"
                onClick={() => {
                  // Só preenche: quem envia é a pessoa.
                  setPergunta(texto)
                  setErro(null)
                  campoRef.current?.focus()
                }}
                className="flex h-full w-full items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left text-sm font-medium shadow-baixa transition-[translate,border-color] outline-none hover:border-neon-violet focus-visible:ring-2 focus-visible:ring-ring motion-safe:hover:-translate-y-0.5"
              >
                <Icone aria-hidden="true" className="size-5 shrink-0 text-brand-detail" strokeWidth={1.75} />
                {texto}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        noValidate
        className={cn('sticky bottom-3 z-10 grid gap-1.5 pt-2', conversando && 'mt-auto')}
        onSubmit={(evento) => {
          evento.preventDefault()
          enviar()
        }}
      >
        <div
          className={cn(
            'flex items-end gap-2 rounded-[1.75rem] border border-input bg-surface py-2 pr-2 pl-5 shadow-media transition-colors focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/20',
            erro && 'border-destructive',
          )}
        >
          <label htmlFor={idCampo} className="sr-only">
            Sua pergunta
          </label>
          <textarea
            ref={campoRef}
            id={idCampo}
            rows={1}
            value={pergunta}
            onChange={(evento) => setPergunta(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter' && !evento.shiftKey && !evento.nativeEvent.isComposing) {
                evento.preventDefault()
                enviar()
              }
            }}
            placeholder="Pergunte sobre seu desenvolvimento..."
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? `${idErro} ${idContador}` : idContador}
            className="field-sizing-content max-h-40 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground"
          />
          <span className="hidden shrink-0 pb-2.5 text-xs text-muted-foreground tabular-nums sm:block" aria-hidden="true">
            {total}/{LIMITE_PERGUNTA}
          </span>
          <Button
            type="submit"
            size="icon"
            aria-label="Pedir orientação"
            disabled={pendente.orientacao}
            className="size-11 shrink-0 rounded-full bg-linear-to-r from-primary to-neon-violet shadow-neon hover:brightness-105"
          >
            {pendente.orientacao ? (
              <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />
            ) : (
              <ArrowUp aria-hidden="true" className="size-5" />
            )}
          </Button>
        </div>
        {erro && (
          <p id={idErro} role="alert" className="px-5 text-sm text-destructive">
            {erro}
          </p>
        )}
        <p id={idContador} className="px-5 text-xs text-muted-foreground">
          <span className="sr-only">
            {total}/{LIMITE_PERGUNTA} caracteres
          </span>
          Enter envia; Shift+Enter quebra a linha. Cada pergunta é independente.
        </p>
      </form>
    </div>
  )
}

export default function PaginaOrientacao() {
  const { orientacao, pendente, falha, aviso } = useJornada()
  const semConversa = !orientacao && !pendente.orientacao && !falha.orientacao && aviso !== 'orientacao-cancelada'

  return (
    <div className={cn('mx-auto flex min-h-[calc(100svh-7.5rem)] w-full max-w-3xl flex-col gap-5 pt-2 sm:gap-8', semConversa && 'fundo-orientador justify-center')}>
      {semConversa && <Abertura />}
      <ExigeConsentimento>
        <Orientacao />
      </ExigeConsentimento>
    </div>
  )
}
