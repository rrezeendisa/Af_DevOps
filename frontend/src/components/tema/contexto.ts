import { createContext, useContext } from 'react'
import type { PreferenciaTema, TemaAplicado } from '@/lib/tema'

export type ValorTema = {
  preferencia: PreferenciaTema
  tema: TemaAplicado
  definirPreferencia(preferencia: PreferenciaTema): void
}

export const TemaContext = createContext<ValorTema | null>(null)

export function useTema(): ValorTema {
  const valor = useContext(TemaContext)
  if (valor === null) {
    throw new Error('useTema precisa estar dentro de <ProvedorTema>.')
  }
  return valor
}
