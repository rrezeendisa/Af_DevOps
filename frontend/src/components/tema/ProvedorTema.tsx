import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  aplicarTema,
  consultaSistema,
  lerPreferencia,
  resolverTema,
  salvarPreferencia,
  type PreferenciaTema,
  type TemaAplicado,
} from '@/lib/tema'
import { TemaContext, type ValorTema } from './contexto'

export function ProvedorTema({ children }: { children: ReactNode }) {
  const [preferencia, setPreferencia] = useState<PreferenciaTema>(lerPreferencia)
  const [temaSistema, setTemaSistema] = useState<TemaAplicado>(() => resolverTema('sistema'))
  const tema = preferencia === 'sistema' ? temaSistema : preferencia

  useEffect(() => {
    aplicarTema(tema)
  }, [tema])

  useEffect(() => {
    const consulta = consultaSistema()
    if (!consulta) {
      return
    }
    const aoMudar = (evento: MediaQueryListEvent) => setTemaSistema(evento.matches ? 'escuro' : 'claro')
    consulta.addEventListener('change', aoMudar)
    return () => consulta.removeEventListener('change', aoMudar)
  }, [])

  const definirPreferencia = useCallback((nova: PreferenciaTema) => {
    salvarPreferencia(nova)
    setPreferencia(nova)
  }, [])

  const valor = useMemo<ValorTema>(
    () => ({ preferencia, tema, definirPreferencia }),
    [preferencia, tema, definirPreferencia],
  )

  return <TemaContext value={valor}>{children}</TemaContext>
}
