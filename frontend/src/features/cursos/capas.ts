import type { NomeFoto } from '@/components/arte/fotos'
import { temaDaCategoria, type TemaVisual } from '@/components/arte/temas'
import type { Curso } from './api'
import { normalizarBusca } from '@/lib/formatacao'

const FOTOS: Record<TemaVisual, NomeFoto> = {
  tecnologia: 'area-tecnologia',
  seguranca: 'capa-seguranca',
  comunicacao: 'area-comunicacao',
  logica: 'area-logica',
  generico: 'experiencia-estudo',
}

const ENQUADRE: Record<TemaVisual, string> = {
  tecnologia: 'object-[50%_18%]',
  seguranca: 'object-[62%_35%]',
  comunicacao: 'object-[80%_22%]',
  logica: 'object-[76%_18%]',
  generico: 'object-[35%_20%]',
}

/**
 * Capas próprias dos cursos de demonstração, escolhidas pelo nome (os IDs mudam entre instalações).
 * Cursos sem capa própria usam a foto do tema.
 */
const POR_NOME = new Map<string, NomeFoto>(
  (
    [
      ['Segurança da informação no cotidiano', 'curso-seguranca-informacao'],
      ['Banco de dados e SQL', 'curso-banco-dados-sql'],
      ['Introdução à arquitetura de software', 'curso-arquitetura-software'],
      ['Fundamentos de desenvolvimento de software', 'curso-desenvolvimento-software'],
      ['Git e GitHub', 'curso-git-github'],
      ['Fundamentos da tecnologia digital', 'curso-tecnologia-digital'],
      ['Lógica de programação', 'curso-logica-programacao'],
      ['Tomada de decisão baseada em dados', 'curso-decisao-dados'],
      ['Resolução estruturada de problemas', 'curso-resolucao-problemas'],
      ['Pensamento computacional', 'curso-pensamento-computacional'],
      ['Algoritmos e estruturas de dados', 'curso-algoritmos-estruturas'],
      ['Feedback e escuta ativa', 'curso-feedback-escuta'],
      ['Liderança e facilitação de equipes', 'curso-lideranca-equipes'],
      ['Apresentações de alto impacto', 'curso-apresentacoes-impacto'],
    ] satisfies [string, NomeFoto][]
  ).map(([nome, foto]) => [normalizarBusca(nome), foto]),
)

/**
 * Capa ilustrativa: o nome decide primeiro (para temas específicos, como segurança) e depois a
 * categoria. Sem correspondência, a foto genérica de estudo.
 */
export function capaDoCurso({ nome, categoria }: Pick<Curso, 'nome' | 'categoria'>): { foto: NomeFoto; enquadre: string } {
  const propria = POR_NOME.get(normalizarBusca(nome))
  if (propria) return { foto: propria, enquadre: 'object-[50%_30%]' }
  const peloNome = temaDaCategoria(nome)
  const tema = peloNome === 'seguranca' ? peloNome : temaDaCategoria(categoria) !== 'generico' ? temaDaCategoria(categoria) : peloNome
  return { foto: FOTOS[tema], enquadre: ENQUADRE[tema] }
}
