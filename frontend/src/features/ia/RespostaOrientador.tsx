import { FileText, Sparkles } from 'lucide-react'
import { BadgeStatus } from '@/components/feedback/BadgeStatus'
import { MascoteEvolia } from '@/components/marca/MascoteEvolia'
import type { Orientacao } from './api'

/** Pergunta do colaborador, alinhada à direita. */
export function Pergunta({ texto }: { texto: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-3xl rounded-br-md bg-selected px-5 py-3 text-base whitespace-pre-line text-foreground">
        <span className="sr-only">Sua pergunta: </span>
        {texto}
      </p>
    </div>
  )
}

const TITULO = 'font-sans text-sm font-semibold'
const CHIP = 'rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs'

/** Resposta da IA. Tudo é texto: o React escapa o conteúdo e nada é interpretado como HTML. */
export function Resposta({ resposta }: { resposta: Orientacao }) {
  return (
    <section aria-labelledby="titulo-orientacao" className="flex items-start gap-3">
      <MascoteEvolia decorativo flutuar={false} className="mt-1 w-10 shrink-0 sm:w-14" />
      <div className="grid min-w-0 flex-1 gap-5">
        <div className="grid gap-2">
          <h2 id="titulo-orientacao" className="sr-only">
            Orientação
          </h2>
          <p className="text-base leading-relaxed whitespace-pre-line">{resposta.orientacao}</p>
        </div>

        <section aria-labelledby="titulo-proximos" className="grid gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="titulo-proximos" className={TITULO}>
              Próximos passos sugeridos
            </h2>
            {resposta.proximosPassos && (
              <BadgeStatus tom="rosa" icone={Sparkles}>
                Gerado por IA
              </BadgeStatus>
            )}
          </div>
          {resposta.proximosPassos ? (
            <ol className="grid gap-2">
              {resposta.proximosPassos.map((passo, indice) => (
                <li key={indice} className="flex items-baseline gap-3 text-sm [counter-increment:passo] before:flex before:size-6 before:shrink-0 before:items-center before:justify-center before:rounded-full before:bg-lavagem-lilas before:text-xs before:font-semibold before:content-[counter(passo)]">
                  {passo}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              Próximos passos complementares não estão disponíveis agora. A orientação acima continua válida.
            </p>
          )}
        </section>

        <section aria-label="Cursos citados" className="grid gap-2">
          <h2 className={TITULO}>Cursos citados</h2>
          {resposta.cursosRecomendados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum curso citado nesta orientação.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {resposta.cursosRecomendados.map((codigo, indice) => (
                <li key={`${codigo}-${indice}`} className={CHIP}>
                  <code className="font-mono">{codigo}</code>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">Códigos do acervo de documentos da IA, não do catálogo.</p>
        </section>

        <section aria-label="Fontes consultadas" className="grid gap-2">
          <h2 className={TITULO}>Fontes consultadas</h2>
          {resposta.fontes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma fonte informada.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {resposta.fontes.map((fonte, indice) => (
                <li key={`${fonte}-${indice}`} className={`${CHIP} flex items-center gap-1.5 break-all`}>
                  <FileText aria-hidden="true" className="size-3.5 shrink-0 text-brand-detail" />
                  <span>{fonte}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  )
}
