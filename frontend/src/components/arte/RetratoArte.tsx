import { cn } from '@/lib/utils'

/** Pétala de 160×160 com a ponta no canto inferior direito. */
const PETALA = 'M160 160H80A80 80 0 0 1 0 80 80 80 0 0 1 80 0 80 80 0 0 1 160 80Z'

/**
 * Composição vertical (4:5), fallback das fotografias de retrato (hero e login): três pétalas
 * grandes, um disco e um traço. Decorativa.
 */
export function RetratoArte({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      data-retrato=""
      className={cn('size-full', className)}
    >
      <rect width="320" height="400" className="fill-lavagem-lilas" />
      <path d={PETALA} transform="translate(-10 60) scale(1.06)" className="fill-secondary" />
      <path d={PETALA} transform="translate(330 70) rotate(90) scale(1.02)" className="fill-primary" />
      <path d={PETALA} transform="translate(166 400) rotate(180) scale(1.1) translate(-160 0)" className="fill-highlight" />
      <circle cx="248" cy="316" r="44" className="fill-surface" />
      <path
        d="M-10 372C60 300 104 318 150 262s62-118 190-128"
        className="fill-none stroke-foreground [stroke-linecap:round] [stroke-width:2.5]"
      />
    </svg>
  )
}
