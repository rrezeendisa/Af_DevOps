import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Rótulo, título editorial e apoio de uma seção. */
export function Titulo({ id, rotulo, titulo, apoio, className }: { id: string; rotulo: string; titulo: ReactNode; apoio?: string; className?: string }) {
  return (
    <div className={cn('grid max-w-2xl gap-4', className)}>
      <p className="rotulo-editorial">{rotulo}</p>
      <h2 id={id} className="text-titulo font-semibold">
        {titulo}
      </h2>
      {apoio && <p className="text-subtitulo text-muted-foreground">{apoio}</p>}
    </div>
  )
}
