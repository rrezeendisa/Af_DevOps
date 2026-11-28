import { normalizarBusca } from '@/lib/formatacao'

export type TemaVisual = 'tecnologia' | 'seguranca' | 'comunicacao' | 'logica' | 'generico'

/** A ordem importa: “Segurança da informação” é mais específico que “Tecnologia”. */
const PALAVRAS: readonly [Exclude<TemaVisual, 'generico'>, readonly string[]][] = [
  ['seguranca', ['seguranca', 'privacidade', 'ciberseguranca']],
  ['comunicacao', ['comunicacao', 'apresentac', 'oratoria', 'feedback']],
  ['logica', ['logica', 'raciocinio', 'algoritm', 'matematica', 'problemas']],
  ['tecnologia', ['tecnologia', 'software', 'desenvolvimento de', 'programacao', 'dados', 'informatica']],
]

/** Tema visual (só apresentação) a partir do texto livre da categoria. Desconhecida: `generico`. */
export function temaDaCategoria(categoria: string): TemaVisual {
  const texto = normalizarBusca(categoria)
  return PALAVRAS.find(([, palavras]) => palavras.some((palavra) => texto.includes(palavra)))?.[0] ?? 'generico'
}

/** Variação estável (0 a 3) para capas genéricas, a partir do nome da categoria. */
export function variacaoDe(semente: string): 0 | 1 | 2 | 3 {
  let soma = 0
  for (const caractere of normalizarBusca(semente)) soma = (soma + (caractere.codePointAt(0) ?? 0)) % 4
  return soma as 0 | 1 | 2 | 3
}
