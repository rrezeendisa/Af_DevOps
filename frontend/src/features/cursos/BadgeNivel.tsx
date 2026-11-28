import { BadgeStatus, type TomBadge } from '@/components/feedback/BadgeStatus'
import { ROTULO_NIVEL_CURSO, type NivelCurso } from './api'

// Texto sempre escuro sobre lilás, lima e rosa (12,2:1, 12,5:1 e 6,2:1).
const TOM: Record<NivelCurso, TomBadge> = {
  BASICO: 'marca',
  INTERMEDIARIO: 'destaque',
  AVANCADO: 'rosa',
}

export function BadgeNivel({ nivel }: { nivel: NivelCurso }) {
  return <BadgeStatus tom={TOM[nivel]}>{ROTULO_NIVEL_CURSO[nivel]}</BadgeStatus>
}
