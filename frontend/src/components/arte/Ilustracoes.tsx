import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const TRACO = 'fill-none stroke-foreground [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:3]'

function Quadro({ children, className, nome }: { children: ReactNode; className?: string | undefined; nome: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" data-ilustracao={nome} className={cn('size-24', className)}>
      {children}
    </svg>
  )
}

type Props = { className?: string }

export function IlustracaoLogica({ className }: Props) {
  return (
    <Quadro nome="logica" className={className}>
      <circle cx="78" cy="42" r="32" className="fill-highlight" />
      <path d="M36 34h30v30H46v24h32" className={TRACO} />
      <rect x="22" y="22" width="24" height="24" rx="6" className="fill-surface stroke-foreground [stroke-width:3]" />
      <circle cx="86" cy="88" r="12" className="fill-primary stroke-foreground [stroke-width:3]" />
    </Quadro>
  )
}

export function IlustracaoComunicacao({ className }: Props) {
  return (
    <Quadro nome="comunicacao" className={className}>
      <circle cx="42" cy="74" r="34" className="fill-primary" />
      <path d="M36 26h52a10 10 0 0 1 10 10v28a10 10 0 0 1-10 10H62L44 88V74h-8a10 10 0 0 1-10-10V36a10 10 0 0 1 10-10z" className="fill-surface stroke-foreground [stroke-linejoin:round] [stroke-width:3]" />
      <path d="M42 44h40M42 58h24" className={TRACO} />
    </Quadro>
  )
}

export function IlustracaoTecnologia({ className }: Props) {
  return (
    <Quadro nome="tecnologia" className={className}>
      <circle cx="76" cy="46" r="34" className="fill-secondary" />
      <rect x="24" y="36" width="72" height="50" rx="8" className="fill-surface stroke-foreground [stroke-width:3]" />
      <path d="M14 94h92M50 52 38 61l12 9M70 52l12 9-12 9" className={TRACO} />
    </Quadro>
  )
}

export function IlustracaoPrivacidade({ className }: Props) {
  return (
    <Quadro nome="privacidade" className={className}>
      <circle cx="40" cy="78" r="30" className="fill-secondary" />
      <circle cx="86" cy="34" r="18" className="fill-highlight" />
      <rect x="34" y="52" width="52" height="44" rx="10" className="fill-surface stroke-foreground [stroke-width:3]" />
      <path d="M44 52V40a16 16 0 0 1 32 0v12M60 70v10" className={TRACO} />
    </Quadro>
  )
}

export function IlustracaoVazio({ className }: Props) {
  return (
    <Quadro nome="vazio" className={className}>
      <ellipse cx="60" cy="96" rx="40" ry="8" className="fill-lavagem-lilas" />
      <path d="M56 58H40A16 16 0 0 1 24 42a16 16 0 0 1 16-16 16 16 0 0 1 16 16z" className="fill-secondary" />
      <path d="M64 58V42a16 16 0 0 1 16-16 16 16 0 0 1 16 16 16 16 0 0 1-16 16z" className="fill-primary" />
      <path d="M64 66h16a16 16 0 0 1 16 16 16 16 0 0 1-16 16 16 16 0 0 1-16-16z" className="fill-highlight" />
      <path d="M56 66v16a16 16 0 0 1-16 16 16 16 0 0 1-16-16 16 16 0 0 1 16-16z" className="fill-none stroke-foreground [stroke-dasharray:5_6] [stroke-width:2.5]" />
    </Quadro>
  )
}
