import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const ATRASO = ['', 'delay-100', 'delay-200', 'delay-300'] as const

type Props = {
  children: ReactNode
  /** Escalonamento entre irmãos: 0 a 3. */
  ordem?: 0 | 1 | 2 | 3
  className?: string
}

/**
 * Entrada suave quando o bloco aparece na tela. Só altera opacidade e posição: o conteúdo continua
 * no DOM e acessível. Sem `IntersectionObserver` ou com movimento reduzido, aparece direto.
 */
export function Revelar({ children, ordem = 0, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visivel, setVisivel] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const elemento = ref.current
    if (visivel || !elemento) return
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          setVisivel(true)
          observador.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [visivel])

  return (
    <div
      ref={ref}
      data-visivel={visivel}
      className={cn(
        'transition-[opacity,transform] duration-500 ease-suave motion-reduce:translate-y-0 motion-reduce:opacity-100',
        ATRASO[ordem],
        // Foco por teclado dentro do bloco nunca fica invisível.
        visivel ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 focus-within:translate-y-0 focus-within:opacity-100',
        className,
      )}
    >
      {children}
    </div>
  )
}
