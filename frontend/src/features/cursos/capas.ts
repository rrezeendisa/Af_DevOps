import type { NomeFoto } from '@/components/arte/fotos'
import { temaDaCategoria, type TemaVisual } from '@/components/arte/temas'
import type { Curso } from './api'

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
 * Capa ilustrativa: o nome decide primeiro (para temas específicos, como segurança) e depois a
 * categoria. Sem correspondência, a foto genérica de estudo.
 */
export function capaDoCurso({ nome, categoria }: Pick<Curso, 'nome' | 'categoria'>): { foto: NomeFoto; enquadre: string } {
  const peloNome = temaDaCategoria(nome)
  const tema = peloNome === 'seguranca' ? peloNome : temaDaCategoria(categoria) !== 'generico' ? temaDaCategoria(categoria) : peloNome
  return { foto: FOTOS[tema], enquadre: ENQUADRE[tema] }
}
