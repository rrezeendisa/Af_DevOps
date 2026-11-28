import { cn } from '@/lib/utils'
import { NIVEIS_COMPETENCIA, ROTULO_NIVEL_COMPETENCIA, type NivelCompetencia as Nivel } from './api'

/**
 * Indicador ordinal do nível estimado (posição 1 a 3), sem percentual nem grau de confiança.
 * O texto carrega a informação; as barras são decorativas.
 */
export function NivelCompetencia({ nivel, compacto = false }: { nivel: Nivel; compacto?: boolean }) {
  const posicao = NIVEIS_COMPETENCIA.indexOf(nivel) + 1
  return (
    <div className="grid gap-2">
      <p className={cn('font-semibold', compacto ? 'text-lg' : 'text-3xl tracking-[-0.01em]')}>
        {ROTULO_NIVEL_COMPETENCIA[nivel]}
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          (nível {posicao} de {NIVEIS_COMPETENCIA.length})
        </span>
      </p>
      <div aria-hidden="true" className="flex gap-1.5">
        {NIVEIS_COMPETENCIA.map((item, indice) => (
          <span
            key={item}
            className={cn('h-2 flex-1 rounded-full', indice < posicao ? 'bg-primary' : 'bg-surface-2 ring-1 ring-border ring-inset')}
          />
        ))}
      </div>
    </div>
  )
}
