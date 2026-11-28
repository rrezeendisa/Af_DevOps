import { CircleCheck, CircleX, Clock } from 'lucide-react'
import { BadgeStatus, type TomBadge } from '@/components/feedback/BadgeStatus'
import type { StatusTreinamento } from './api'

const VISUAL: Record<StatusTreinamento, { rotulo: string; tom: TomBadge; icone: typeof Clock }> = {
  PENDENTE: { rotulo: 'Pendente', tom: 'marca', icone: Clock },
  CONCLUIDO: { rotulo: 'Concluído', tom: 'destaque', icone: CircleCheck },
  FALHOU: { rotulo: 'Falhou', tom: 'erro', icone: CircleX },
}

export function BadgeStatusTreinamento({ status }: { status: StatusTreinamento }) {
  const { rotulo, tom, icone } = VISUAL[status]
  return (
    <BadgeStatus tom={tom} icone={icone}>
      {rotulo}
    </BadgeStatus>
  )
}
