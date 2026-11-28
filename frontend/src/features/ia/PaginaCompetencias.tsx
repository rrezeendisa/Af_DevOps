import { ArrowRight, Sparkles } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router'
import { MensagemErro } from '@/components/feedback/MensagemErro'
import { CabecalhoPagina } from '@/components/layout/CabecalhoPagina'
import { Button } from '@/components/ui/button'
import { ExigeConsentimento } from '@/features/consentimento/ExigeConsentimento'
import { cn } from '@/lib/utils'
import { COMPETENCIAS, NOTAS, type CampoCompetencia } from './api'
import { useJornada } from './contextoJornada'
import { NivelCompetencia } from './NivelCompetencia'

function EscalaNota({ campo, rotulo }: { campo: CampoCompetencia; rotulo: string }) {
  const { notas, definirNota } = useJornada()
  const id = useId()
  return (
    <fieldset className="grid gap-3" aria-describedby={`${id}-escala`}>
      <legend className="text-base font-semibold">{rotulo}</legend>
      <div className="flex flex-wrap gap-2">
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
            <span
              className={cn(
                'flex size-12 cursor-pointer items-center justify-center rounded-xl border border-input bg-surface text-base font-semibold tabular-nums transition-colors',
                'hover:bg-surface-2 peer-checked:border-transparent peer-checked:bg-primary peer-checked:text-primary-foreground',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
              )}
            >
              {nota}
            </span>
          </label>
        ))}
      </div>
      <p id={`${id}-escala`} className="text-sm text-muted-foreground">
        1 = pouco desenvolvida · 5 = muito desenvolvida
      </p>
    </fieldset>
  )
}

function Avaliacao() {
  const { competenciasCompletas, classificar, classificacao, pendente, falha } = useJornada()
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <form
        className="grid content-start gap-7 rounded-2xl border border-border bg-surface p-6"
        onSubmit={(evento) => {
          evento.preventDefault()
          void classificar()
        }}
      >
        <div className="grid gap-1">
          <h2 className="font-sans text-lg font-semibold">Como você avalia suas competências?</h2>
          <p className="text-sm text-muted-foreground">Escolha uma nota de 1 a 5 para cada competência.</p>
        </div>
        {COMPETENCIAS.map(({ campo, rotulo }) => (
          <EscalaNota key={campo} campo={campo} rotulo={rotulo} />
        ))}
        {falha.classificacao && <MensagemErro titulo="Não foi possível classificar">{falha.classificacao}</MensagemErro>}
        <Button type="submit" className="justify-self-start" disabled={!competenciasCompletas || pendente.classificacao}>
          <Sparkles aria-hidden="true" />
          {pendente.classificacao ? 'Classificando…' : 'Classificar'}
        </Button>
      </form>

      <section aria-labelledby="titulo-resultado" className="grid content-start gap-4" aria-live="polite">
        {classificacao ? (
          <div className="grid gap-5 rounded-2xl bg-accent p-6 text-accent-foreground dark:border dark:border-accent/30 dark:bg-surface-2 dark:text-foreground">
            <h2 id="titulo-resultado" className="font-sans text-sm font-semibold tracking-[0.04em] uppercase">
              Nível estimado
            </h2>
            <NivelCompetencia nivel={classificacao.nivel} />
            <p className="text-sm">
              Estimativa do modelo de classificação a partir das notas que você informou. Não representa avaliação de
              desempenho, certificação ou conclusão profissional.
            </p>
            <p className="text-sm opacity-80">Versão do modelo: {classificacao.versaoModelo}</p>
            <p className="text-xs opacity-80">
              Este é um nível de competência, diferente dos níveis Básico, Intermediário e Avançado dos cursos do catálogo.
            </p>
            <Button asChild variant="outline" className="justify-self-start">
              <Link to="/recomendacoes">
                Ver recomendações
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 rounded-2xl bg-surface-2 p-6 text-sm text-muted-foreground">
            <h2 id="titulo-resultado" className="font-sans text-base font-semibold text-foreground">
              Resultado
            </h2>
            <p>Depois de escolher as três notas, o modelo estima seu nível de competência.</p>
            <p>Alterar qualquer nota descarta a classificação e as recomendações anteriores.</p>
          </div>
        )}
      </section>
    </div>
  )
}

export default function PaginaCompetencias() {
  return (
    <div className="grid gap-8 pt-2">
      <CabecalhoPagina
        titulo="Competências"
        descricao="Avalie lógica, comunicação e tecnologia para receber uma estimativa do seu nível."
      />
      <ExigeConsentimento>
        <Avaliacao />
      </ExigeConsentimento>
    </div>
  )
}
