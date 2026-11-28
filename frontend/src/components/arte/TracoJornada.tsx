import { cn } from '@/lib/utils'

/** Linha orgânica que liga etapas. Decorativa: a ordem precisa estar no texto. */
export function TracoJornada({ className, animar = false }: { className?: string; animar?: boolean }) {
  return (
    <svg
      viewBox="0 0 400 80"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn('pointer-events-none h-16 w-full text-primary', className)}
    >
      <path
        d="M4 58C58 58 66 18 124 18s70 46 134 46 76-48 138-44"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
        className={cn(animar && 'motion-safe:animate-tracar')}
      />
    </svg>
  )
}
