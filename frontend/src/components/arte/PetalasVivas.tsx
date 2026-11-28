import { SimboloMarca } from '@/components/marca/SimboloMarca'
import { cn } from '@/lib/utils'

/** Símbolo da Evolia “respirando”, com um halo suave. Decorativo; para o Orientador e esperas. */
export function PetalasVivas({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('relative inline-flex size-24 items-center justify-center', className)}>
      <span className="absolute inset-0 rounded-full bg-lavagem-lilas motion-safe:animate-respirar" />
      <span className="absolute inset-[16%] rounded-full bg-surface shadow-media" />
      <SimboloMarca className="relative size-[52%] motion-safe:animate-respirar" />
    </span>
  )
}
