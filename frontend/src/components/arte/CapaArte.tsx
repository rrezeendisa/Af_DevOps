import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { variacaoDe, type TemaVisual } from './temas'

const PETALA = 'M60 60H30A30 30 0 0 1 0 30 30 30 0 0 1 30 0 30 30 0 0 1 60 30Z'

const FUNDO: Record<TemaVisual, string> = {
  tecnologia: 'fill-lavagem-lilas',
  seguranca: 'fill-lavagem-lima',
  comunicacao: 'fill-lavagem-rosa',
  logica: 'fill-lavagem-lima',
  generico: 'fill-lavagem-lilas',
}

const TRACO = 'fill-none stroke-foreground [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:3]'

const DESENHOS: Record<Exclude<TemaVisual, 'generico'>, ReactNode> = {
  tecnologia: (
    <>
      <circle cx="238" cy="52" r="58" className="fill-secondary" />
      <rect x="62" y="44" width="150" height="96" rx="12" className="fill-surface" />
      <rect x="62" y="44" width="150" height="96" rx="12" className={TRACO} />
      <path d="M44 150h186" className={TRACO} />
      <path d="M108 76 88 93l20 17M166 76l20 17-20 17M146 70l-18 46" className={TRACO} />
      <circle cx="252" cy="126" r="22" className="fill-primary" />
    </>
  ),
  seguranca: (
    <>
      <circle cx="82" cy="136" r="62" className="fill-highlight" />
      <path d="M160 30l62 22v38c0 38-26 62-62 74-36-12-62-36-62-74V52z" className="fill-surface" />
      <path d="M160 30l62 22v38c0 38-26 62-62 74-36-12-62-36-62-74V52z" className={TRACO} />
      <path d="m134 96 19 19 35-38" className={TRACO} />
      <circle cx="250" cy="48" r="20" className="fill-secondary" />
    </>
  ),
  comunicacao: (
    <>
      <circle cx="244" cy="130" r="56" className="fill-primary" />
      <path d="M52 38h128a14 14 0 0 1 14 14v52a14 14 0 0 1-14 14h-72l-32 24v-24H52a14 14 0 0 1-14-14V52a14 14 0 0 1 14-14z" className="fill-surface" />
      <path d="M52 38h128a14 14 0 0 1 14 14v52a14 14 0 0 1-14 14h-72l-32 24v-24H52a14 14 0 0 1-14-14V52a14 14 0 0 1 14-14z" className={TRACO} />
      <path d="M66 68h100M66 88h64" className={TRACO} />
      <rect x="190" y="66" width="90" height="56" rx="16" className="fill-secondary" />
      <circle cx="213" cy="94" r="4" className="fill-accent-foreground" />
      <circle cx="235" cy="94" r="4" className="fill-accent-foreground" />
      <circle cx="257" cy="94" r="4" className="fill-accent-foreground" />
    </>
  ),
  logica: (
    <>
      <circle cx="246" cy="54" r="46" className="fill-highlight" />
      <path d="M80 54h82v36h-62v44h112" className={TRACO} />
      <rect x="44" y="34" width="40" height="40" rx="10" className="fill-surface stroke-foreground [stroke-width:3]" />
      <rect x="142" y="70" width="40" height="40" rx="20" className="fill-primary stroke-foreground [stroke-width:3]" />
      <path d="m232 112 26 22-26 22-26-22z" className="fill-secondary stroke-foreground [stroke-width:3] [stroke-linejoin:round]" />
    </>
  ),
}

/** Quatro composições de pétalas para categorias sem tema conhecido. */
const GENERICAS: readonly (readonly [string, string])[] = [
  ['translate(70 30) scale(2)', 'translate(190 70) rotate(90 30 30) scale(1.3)'],
  ['translate(150 24) rotate(90 60 60) scale(2)', 'translate(48 78) scale(1.4)'],
  ['translate(96 48) rotate(180 60 60) scale(2)', 'translate(222 24) rotate(270 30 30)'],
  ['translate(36 24) rotate(270 60 60) scale(2)', 'translate(170 82) rotate(180 30 30) scale(1.5)'],
]

/** Ilustração de capa (16:9). Decorativa; é o fallback das fotografias de curso. */
export function CapaArte({ tema, semente = '', className }: { tema: TemaVisual; semente?: string; className?: string }) {
  const [maior, menor] = GENERICAS[variacaoDe(semente)] ?? ['', '']
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      data-tema={tema}
      className={cn('size-full', className)}
    >
      <rect width="320" height="180" className={FUNDO[tema]} />
      {tema === 'generico' ? (
        <>
          <path d={PETALA} transform={maior} className="fill-secondary" />
          <path d={PETALA} transform={menor} className="fill-primary" />
          <circle cx="278" cy="146" r="16" className="fill-highlight" />
        </>
      ) : (
        DESENHOS[tema]
      )}
    </svg>
  )
}
