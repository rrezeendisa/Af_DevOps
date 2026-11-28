import { CapaArte } from './CapaArte'
import { Foto } from './Foto'
import { temaDaCategoria } from './temas'

/** Capa de uma categoria: fotografia local quando existir, ilustração caso contrário. Decorativa. */
export function CapaTematica({ categoria, className }: { categoria: string; className?: string }) {
  const tema = temaDaCategoria(categoria)
  const arte = <CapaArte tema={tema} semente={categoria} />
  if (tema === 'generico') {
    return <div className={className}>{arte}</div>
  }
  return (
    <div className={className}>
      <Foto nome={`capa-${tema}`} alt="" fallback={arte} largura={960} altura={540} />
    </div>
  )
}
