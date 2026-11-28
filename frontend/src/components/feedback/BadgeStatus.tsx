import { CircleAlert, CircleCheck, CircleX, Hammer, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'

export type TomBadge = 'neutro' | 'marca' | 'destaque' | 'rosa' | 'sucesso' | 'atencao' | 'erro'

const ICONES: Partial<Record<TomBadge, LucideIcon>> = {
  sucesso: CircleCheck,
  atencao: CircleAlert,
  erro: CircleX,
}

type Props = {
  tom?: TomBadge
  icone?: LucideIcon
  children: ReactNode
}

/** Badge semântico: o estado é sempre expresso também por texto (e ícone nos tons de status). */
export function BadgeStatus({ tom = 'neutro', icone, children }: Props) {
  const Icone = icone ?? ICONES[tom]
  return (
    <Badge variant={tom === 'rosa' ? 'default' : tom}>
      {Icone && <Icone aria-hidden="true" />}
      {children}
    </Badge>
  )
}

/** Marca uma tela ou atalho ainda sem implementação. */
export function BadgePendente() {
  return (
    <BadgeStatus tom="destaque" icone={Hammer}>
      Em desenvolvimento
    </BadgeStatus>
  )
}
