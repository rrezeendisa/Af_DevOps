import { cn } from '@/lib/utils'

/**
 * Assinatura gráfica da Evolia: um círculo rosa e um círculo lima sobreposto, sempre inteiros
 * (nunca recortados pelo contêiner). Puramente decorativa. Usada no banner de boas-vindas e
 * no login.
 */
export function FormasOrganicas({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      className={cn('pointer-events-none', className)}
      aria-hidden="true"
      focusable="false"
      data-decorativo=""
    >
      <circle cx="152" cy="86" r="78" className="fill-primary" />
      <circle cx="80" cy="134" r="58" className="fill-highlight" />
    </svg>
  )
}
