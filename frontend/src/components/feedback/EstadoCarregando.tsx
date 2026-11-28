import { Skeleton } from '@/components/ui/skeleton'

type Props = { texto?: string; linhas?: number }

/** Skeleton discreto com texto anunciado a leitores de tela. */
export function EstadoCarregando({ texto = 'Carregando…', linhas = 3 }: Props) {
  return (
    <div role="status" aria-live="polite" className="grid gap-3">
      <span className="sr-only">{texto}</span>
      {Array.from({ length: linhas }, (_, indice) => (
        <Skeleton key={indice} aria-hidden="true" className="h-4 rounded-md bg-surface-2" style={{ width: `${92 - indice * 14}%` }} />
      ))}
    </div>
  )
}
