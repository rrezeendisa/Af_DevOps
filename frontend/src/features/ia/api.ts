import { z } from 'zod'
import { TEMPOS_LIMITE_MS, type SessaoApi } from '@/lib/api/cliente'

/** `IaDtos.Nivel`: nível de competência estimado. Não é o nível dos cursos do catálogo. */
export const NIVEIS_COMPETENCIA = ['INICIANTE', 'INTERMEDIARIO', 'AVANCADO'] as const
export type NivelCompetencia = (typeof NIVEIS_COMPETENCIA)[number]

export const ROTULO_NIVEL_COMPETENCIA: Record<NivelCompetencia, string> = {
  INICIANTE: 'Iniciante',
  INTERMEDIARIO: 'Intermediário',
  AVANCADO: 'Avançado',
}

export const COMPETENCIAS = [
  { campo: 'logica', rotulo: 'Lógica' },
  { campo: 'comunicacao', rotulo: 'Comunicação' },
  { campo: 'tecnologia', rotulo: 'Tecnologia' },
] as const

export type CampoCompetencia = (typeof COMPETENCIAS)[number]['campo']
export type Nota = 1 | 2 | 3 | 4 | 5
export const NOTAS: readonly Nota[] = [1, 2, 3, 4, 5]
export type Competencias = Record<CampoCompetencia, Nota>

/** `IaDtos.Classificacao`: `{ nivel, versaoModelo }`. */
const esquemaClassificacao = z.object({ nivel: z.enum(NIVEIS_COMPETENCIA), versaoModelo: z.string() })
export type Classificacao = z.infer<typeof esquemaClassificacao>

/**
 * `IaDtos.Recomendacoes`. `cursoId` é o código documental do acervo do Python (ex.: `CURSO-001`) e
 * nunca é convertido para o id numérico do catálogo Java.
 */
const esquemaRecomendacoes = z.object({
  recomendacoes: z.array(z.object({ cursoId: z.string(), nome: z.string(), justificativa: z.string() })),
  fontes: z.array(z.string()),
})
export type Recomendacoes = z.infer<typeof esquemaRecomendacoes>

/**
 * `IaDtos.Orientacao` (`proximosPassos` com `@JsonInclude(NON_EMPTY)`). Quando presente, o
 * `OllamaProximosPassosAdapter` garante de 1 a 3 frases de 1 a 120 code points.
 */
const esquemaOrientacao = z.object({
  orientacao: z.string(),
  cursosRecomendados: z.array(z.string()),
  fontes: z.array(z.string()),
  proximosPassos: z.array(z.string().min(1)).min(1).max(3).optional(),
})
export type Orientacao = z.infer<typeof esquemaOrientacao>

export const lerClassificacao = (dados: unknown): Classificacao => esquemaClassificacao.parse(dados)
export const lerRecomendacoes = (dados: unknown): Recomendacoes => esquemaRecomendacoes.parse(dados)
export const lerOrientacao = (dados: unknown): Orientacao => esquemaOrientacao.parse(dados)

/** Limite de `IaEntrada.orientacao` e do Python: 1 a 1000 code points. */
export const LIMITE_PERGUNTA = 1000

export function contarCaracteres(texto: string): number {
  return [...texto].length
}

export function problemaNaPergunta(pergunta: string): string | null {
  const aparada = pergunta.trim()
  if (aparada === '') return 'Escreva sua pergunta.'
  if (contarCaracteres(aparada) > LIMITE_PERGUNTA) return `Use no máximo ${LIMITE_PERGUNTA} caracteres.`
  return null
}

/** Corpo exato de `IaEntrada.classificacao`: somente as três notas. */
export function classificar(api: SessaoApi, c: Competencias, signal: AbortSignal): Promise<Classificacao> {
  return api.enviar(
    '/api/ia/classificacoes',
    { logica: c.logica, comunicacao: c.comunicacao, tecnologia: c.tecnologia },
    lerClassificacao,
    { signal, tempoLimiteMs: TEMPOS_LIMITE_MS.ia },
  )
}

/** Corpo exato de `IaEntrada.recomendacao`: as três notas planas e o nível retornado. */
export function recomendar(api: SessaoApi, c: Competencias, nivel: NivelCompetencia, signal: AbortSignal): Promise<Recomendacoes> {
  return api.enviar(
    '/api/ia/recomendacoes',
    { logica: c.logica, comunicacao: c.comunicacao, tecnologia: c.tecnologia, nivel },
    lerRecomendacoes,
    { signal, tempoLimiteMs: TEMPOS_LIMITE_MS.ia },
  )
}

/** Corpo exato de `IaEntrada.orientacao`: a pergunta e as notas aninhadas em `competencias`. */
export function orientar(api: SessaoApi, pergunta: string, c: Competencias, signal: AbortSignal): Promise<Orientacao> {
  return api.enviar(
    '/api/ia/orientacoes',
    { pergunta, competencias: { logica: c.logica, comunicacao: c.comunicacao, tecnologia: c.tecnologia } },
    lerOrientacao,
    { signal, tempoLimiteMs: TEMPOS_LIMITE_MS.orientacao },
  )
}
