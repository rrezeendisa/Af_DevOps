import { GraduationCap, RefreshCw, SearchX } from 'lucide-react'
import { Link } from 'react-router'
import { EstadoCarregando } from '@/components/feedback/EstadoCarregando'
import { EstadoVazio } from '@/components/feedback/EstadoVazio'
import { MensagemErro } from '@/components/feedback/MensagemErro'
import { CabecalhoPagina } from '@/components/layout/CabecalhoPagina'
import { Button } from '@/components/ui/button'
import { ExigeConsentimento } from '@/features/consentimento/ExigeConsentimento'
import { COMPETENCIAS, ROTULO_NIVEL_COMPETENCIA } from './api'
import { useJornada } from './contextoJornada'
import { ListaFontes } from './ListaFontes'

function Recomendacoes() {
  const { notas, classificacao, recomendacoes, pendente, falha, recomendar } = useJornada()

  if (!classificacao) {
    return (
      <EstadoVazio
        icone={GraduationCap}
        titulo="Faça a avaliação primeiro"
        descricao="As recomendações usam as notas e o nível estimado na avaliação desta sessão."
        acao={
          <Button asChild variant="secondary">
            <Link to="/competencias">Fazer a avaliação</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="grid gap-6">
      <section aria-label="Base das recomendações" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5">
        <div className="grid gap-1 text-sm">
          <p className="font-semibold">Baseado na sua avaliação desta sessão</p>
          <p className="text-muted-foreground">
            {COMPETENCIAS.map(({ campo, rotulo }) => `${rotulo} ${notas[campo] ?? '–'}`).join(' · ')} · Nível estimado{' '}
            {ROTULO_NIVEL_COMPETENCIA[classificacao.nivel]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost">
            <Link to="/competencias">Alterar avaliação</Link>
          </Button>
          <Button onClick={() => void recomendar()} disabled={pendente.recomendacoes}>
            <RefreshCw aria-hidden="true" />
            {pendente.recomendacoes ? 'Gerando…' : recomendacoes ? 'Gerar novamente' : 'Gerar recomendações'}
          </Button>
        </div>
      </section>

      {falha.recomendacoes && <MensagemErro titulo="Não foi possível gerar as recomendações">{falha.recomendacoes}</MensagemErro>}

      {pendente.recomendacoes ? (
        <EstadoCarregando texto="Buscando cursos nos documentos…" />
      ) : recomendacoes ? (
        <div className="grid gap-6" aria-live="polite">
          {recomendacoes.recomendacoes.length === 0 ? (
            <EstadoVazio icone={SearchX} titulo="Nenhum curso compatível" descricao="Não foram encontrados cursos compatíveis nos documentos disponíveis." />
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2" aria-label="Cursos recomendados">
              {recomendacoes.recomendacoes.map((curso, indice) => (
                <li key={`${curso.cursoId}-${indice}`}>
                  <article className="grid h-full content-start gap-3 rounded-2xl border border-border bg-surface p-5">
                    <h2 className="font-sans text-lg leading-snug font-semibold">{curso.nome}</h2>
                    <p className="text-xs text-muted-foreground">
                      Código no acervo: <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-foreground">{curso.cursoId}</code>
                    </p>
                    <p className="text-sm whitespace-pre-line text-muted-foreground">{curso.justificativa}</p>
                  </article>
                </li>
              ))}
            </ul>
          )}
          <ListaFontes fontes={recomendacoes.fontes} />
          <p className="text-xs text-muted-foreground">
            As recomendações vêm do acervo de documentos da IA e podem não corresponder a cursos do catálogo da plataforma.
          </p>
        </div>
      ) : null}
    </div>
  )
}

export default function PaginaRecomendacoes() {
  return (
    <div className="grid gap-8 pt-2">
      <CabecalhoPagina titulo="Recomendações" descricao="Cursos sugeridos para o seu nível, com justificativas e fontes." />
      <ExigeConsentimento>
        <Recomendacoes />
      </ExigeConsentimento>
    </div>
  )
}
