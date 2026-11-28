import { ChartNoAxesColumn, GraduationCap, RefreshCw, SearchX } from 'lucide-react'
import { Link } from 'react-router'
import { Foto } from '@/components/arte/Foto'
import type { NomeFoto } from '@/components/arte/fotos'
import { temaDaCategoria, type TemaVisual } from '@/components/arte/temas'
import { EstadoCarregando } from '@/components/feedback/EstadoCarregando'
import { EstadoVazio } from '@/components/feedback/EstadoVazio'
import { MensagemErro } from '@/components/feedback/MensagemErro'
import { CabecalhoPagina } from '@/components/layout/CabecalhoPagina'
import { Button } from '@/components/ui/button'
import { ExigeConsentimento } from '@/features/consentimento/ExigeConsentimento'
import { COMPETENCIAS, ROTULO_NIVEL_COMPETENCIA } from './api'
import { useJornada } from './contextoJornada'
import { ListaFontes } from './ListaFontes'

/** Foto só ilustrativa, escolhida por palavras do nome. Não é categoria informada pela API. */
const FOTOS: Record<TemaVisual, NomeFoto> = {
  tecnologia: 'area-tecnologia',
  seguranca: 'capa-seguranca',
  comunicacao: 'area-comunicacao',
  logica: 'area-logica',
  generico: 'experiencia-estudo',
}
/** Enquadramento para o rosto ou o assunto não sair da miniatura. */
const ENQUADRE: Record<TemaVisual, string> = {
  tecnologia: 'object-[42%_20%]',
  seguranca: 'object-[70%_30%]',
  comunicacao: 'object-[76%_20%]',
  logica: 'object-[74%_15%]',
  generico: 'object-[30%_20%]',
}

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
    <div className="grid gap-4">
      <section aria-label="Base das recomendações" className="fundo-resultado flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-baixa sm:px-5">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lavagem-lilas text-brand-detail">
          <ChartNoAxesColumn className="size-5" />
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
          <p className="font-semibold">Sua avaliação desta sessão</p>
          <p className="text-muted-foreground">
            {COMPETENCIAS.map(({ campo, rotulo }) => `${rotulo} ${notas[campo] ?? '–'}`).join(' · ')} · Nível estimado{' '}
            {ROTULO_NIVEL_COMPETENCIA[classificacao.nivel]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" className="h-10 rounded-xl">
            <Link to="/competencias">Alterar avaliação</Link>
          </Button>
          <Button className="h-10 rounded-xl" onClick={() => void recomendar()} disabled={pendente.recomendacoes}>
            <RefreshCw aria-hidden="true" />
            {pendente.recomendacoes ? 'Gerando…' : recomendacoes ? 'Gerar novamente' : 'Gerar recomendações'}
          </Button>
        </div>
      </section>

      {falha.recomendacoes && <MensagemErro titulo="Não foi possível gerar as recomendações">{falha.recomendacoes}</MensagemErro>}

      {pendente.recomendacoes ? (
        <EstadoCarregando texto="Buscando cursos nos documentos…" />
      ) : recomendacoes ? (
        <div className="grid gap-4" aria-live="polite">
          {recomendacoes.recomendacoes.length === 0 ? (
            <EstadoVazio icone={SearchX} titulo="Nenhum curso compatível" descricao="Não foram encontrados cursos compatíveis nos documentos disponíveis." />
          ) : (
            <ul className="grid gap-4" aria-label="Cursos recomendados">
              {recomendacoes.recomendacoes.map((curso, indice) => (
                <li key={`${curso.cursoId}-${indice}`}>
                  <article className="grid overflow-hidden rounded-3xl border border-border bg-surface shadow-baixa sm:grid-cols-[13rem_minmax(0,1fr)]">
                    <div className="relative aspect-[16/9] bg-lavagem-lilas sm:aspect-auto sm:min-h-44">
                      <div className="absolute inset-0">
                        <Foto nome={FOTOS[temaDaCategoria(curso.nome)]} alt="" largura={640} altura={480} fallback={null} className={ENQUADRE[temaDaCategoria(curso.nome)]} />
                      </div>
                    </div>
                    <div className="grid content-center gap-2.5 p-5 sm:px-6">
                      <h2 className="text-xl leading-snug font-semibold">{curso.nome}</h2>
                      <p className="text-sm whitespace-pre-line text-muted-foreground">{curso.justificativa}</p>
                      <p className="justify-self-start rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground">
                        Código no acervo: <code className="font-mono text-foreground">{curso.cursoId}</code>
                      </p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
          <ListaFontes fontes={recomendacoes.fontes} />
          <p className="text-xs text-muted-foreground">
            As recomendações vêm do acervo de documentos da IA e podem não corresponder a cursos do catálogo da plataforma. As
            fontes valem para o conjunto: a IA não informa qual delas sustenta cada curso. As imagens são ilustrativas.
          </p>
        </div>
      ) : null}
    </div>
  )
}

export default function PaginaRecomendacoes() {
  return (
    <div className="grid max-w-4xl gap-6 pt-2">
      <CabecalhoPagina titulo="Recomendações para você" descricao="Cursos sugeridos com base na sua avaliação." />
      <ExigeConsentimento>
        <Recomendacoes />
      </ExigeConsentimento>
    </div>
  )
}
