import { ArrowRight, Brain, Code2, MessageCircle, Sparkles, type LucideIcon } from 'lucide-react'
import { useId, useRef } from 'react'
import { Link } from 'react-router'
import { MensagemErro } from '@/components/feedback/MensagemErro'
import { CabecalhoPagina } from '@/components/layout/CabecalhoPagina'
import { MascoteEvolia } from '@/components/marca/MascoteEvolia'
import { Button } from '@/components/ui/button'
import { ExigeConsentimento } from '@/features/consentimento/ExigeConsentimento'
import { cn } from '@/lib/utils'
import { COMPETENCIAS, NOTAS, type CampoCompetencia } from './api'
import { useJornada } from './contextoJornada'
import { NivelCompetencia } from './NivelCompetencia'
import { RadarNotas } from './RadarNotas'

const VISUAL: Record<CampoCompetencia, { icone: LucideIcon; tom: string; descricao: string }> = {
  logica: { icone: Brain, tom: 'bg-lavagem-lima', descricao: 'Resolução de problemas e pensamento estruturado' },
  comunicacao: { icone: MessageCircle, tom: 'bg-lavagem-rosa', descricao: 'Clareza, colaboração e expressão de ideias' },
  tecnologia: { icone: Code2, tom: 'bg-lavagem-lilas', descricao: 'Conhecimento e uso de ferramentas digitais' },
}

/** Uma linha da avaliação: cinco rádios nativos, sem nenhum pré-selecionado. */
function EscalaNota({ campo, rotulo, idEscala }: { campo: CampoCompetencia; rotulo: string; idEscala: string }) {
  const { notas, definirNota } = useJornada()
  const id = useId()
  const { icone: Icone, tom, descricao } = VISUAL[campo]
  return (
    <fieldset aria-describedby={idEscala}>
      <legend className="sr-only">{rotulo}</legend>
      <div className="flex flex-wrap items-center gap-4 px-4 py-5 sm:px-6">
        <span aria-hidden="true" className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl text-brand-detail', tom)}>
          <Icone className="size-5" strokeWidth={1.75} />
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p aria-hidden="true" className="font-semibold">{rotulo}</p>
          <p className="text-sm text-muted-foreground">{descricao}</p>
        </div>
        <div className="grid w-full grid-cols-5 gap-2 md:flex md:w-auto">
          {NOTAS.map((nota) => (
            <label key={nota} className="relative">
              <input
                type="radio"
                name={`${id}-${campo}`}
                value={nota}
                checked={notas[campo] === nota}
                onChange={() => definirNota(campo, nota)}
                className="peer sr-only"
              />
              {/* A escolhida muda de preenchimento, contorno e peso: não depende só da cor. */}
              <span className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-input bg-surface text-base tabular-nums transition-colors hover:bg-surface-2 peer-checked:border-brand-detail peer-checked:bg-brand-detail peer-checked:font-bold peer-checked:text-surface peer-checked:hover:bg-brand-detail peer-checked:ring-2 peer-checked:ring-brand-detail/30 peer-checked:ring-offset-2 peer-checked:ring-offset-surface peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ring md:w-11">
                {nota}
              </span>
            </label>
          ))}
        </div>
      </div>
    </fieldset>
  )
}

function Resultado() {
  const { classificacao, competenciasCompletas } = useJornada()
  if (!classificacao || !competenciasCompletas) return null
  return (
    <div className="fundo-resultado grid gap-6 rounded-3xl border border-border bg-surface p-6 shadow-baixa sm:p-8 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="grid content-start gap-4">
        <h2 id="titulo-resultado" className="rotulo-editorial">
          Nível estimado
        </h2>
        <NivelCompetencia nivel={classificacao.nivel} />
        <dl aria-label="Notas informadas" className="flex flex-wrap gap-2">
          {COMPETENCIAS.map(({ campo, rotulo }) => (
            <div key={campo} className={cn('flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm', VISUAL[campo].tom)}>
              <dt>{rotulo}</dt>
              <dd className="font-semibold tabular-nums">{competenciasCompletas[campo]}</dd>
            </div>
          ))}
        </dl>
        <p className="max-w-prose text-sm">
          Estimativa do modelo de classificação a partir das notas que você informou. Não representa avaliação de
          desempenho, certificação ou conclusão profissional.
        </p>
        <p className="max-w-prose text-xs text-muted-foreground">
          Este é um nível de competência, diferente dos níveis Básico, Intermediário e Avançado dos cursos do catálogo.
        </p>
        <p className="text-xs text-muted-foreground">Versão do modelo: {classificacao.versaoModelo}</p>
        <Button asChild className="h-11 justify-self-start rounded-xl px-5">
          <Link to="/recomendacoes">
            Ver recomendações
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-center gap-4 md:flex-col md:flex-nowrap">
        <MascoteEvolia pose="comemorando" decorativo className="w-20 md:w-24" />
        <RadarNotas notas={competenciasCompletas} />
      </div>
    </div>
  )
}

function Avaliacao() {
  const { notas, competenciasCompletas, classificar, classificacao, descartar, pendente, falha, aviso } = useJornada()
  const formRef = useRef<HTMLFormElement>(null)
  const idEscala = useId()
  const semNotas = Object.keys(notas).length === 0
  return (
    <div className="grid gap-5">
      <form
        ref={formRef}
        className="grid gap-5"
        onSubmit={(evento) => {
          evento.preventDefault()
          void classificar()
        }}
      >
        <div className="divide-y divide-border rounded-3xl border border-border bg-surface shadow-baixa">
          {COMPETENCIAS.map(({ campo, rotulo }) => (
            <EscalaNota key={campo} campo={campo} rotulo={rotulo} idEscala={idEscala} />
          ))}
        </div>
        {falha.classificacao && <MensagemErro titulo="Não foi possível classificar">{falha.classificacao}</MensagemErro>}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="grid gap-0.5 text-sm text-muted-foreground">
            <p id={idEscala}>1 = pouco desenvolvida · 5 = muito desenvolvida</p>
            <p className="text-xs">Alterar qualquer nota descarta a classificação e as recomendações anteriores.</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="ghost" className="h-11 rounded-xl" disabled={semNotas}
              onClick={() => {
                descartar('avaliacao-limpa')
                // O botão fica desabilitado: o foco volta à primeira nota.
                formRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus()
              }}
            >
              Limpar
            </Button>
            <Button type="submit" className="h-11 rounded-xl px-5" disabled={!competenciasCompletas || pendente.classificacao}>
              <Sparkles aria-hidden="true" />
              {pendente.classificacao ? 'Classificando…' : 'Classificar'}
            </Button>
          </div>
        </div>
      </form>

      <p role="status" className="sr-only">
        {aviso === 'avaliacao-limpa' && semNotas ? 'Avaliação limpa.' : ''}
      </p>

      <section aria-labelledby={classificacao ? 'titulo-resultado' : undefined} aria-live="polite">
        <Resultado />
      </section>
    </div>
  )
}

export default function PaginaCompetencias() {
  return (
    <div className="grid max-w-4xl gap-6 pt-2">
      <CabecalhoPagina titulo="Minhas competências" descricao="Avalie cada competência de 1 a 5." />
      <ExigeConsentimento>
        <Avaliacao />
      </ExigeConsentimento>
    </div>
  )
}
