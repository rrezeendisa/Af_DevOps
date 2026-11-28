import { cn } from '@/lib/utils'

/** Pétala com três cantos arredondados e a ponta voltada para o centro do símbolo. */
const PETALA = 'M19 19H9.5A9.5 9.5 0 0 1 0 9.5 9.5 9.5 0 0 1 9.5 0 9.5 9.5 0 0 1 19 9.5Z'

type Props = {
  className?: string
  /** `monocromatico` usa `currentColor` nas quatro pétalas. */
  variante?: 'colorido' | 'monocromatico'
  /** Texto alternativo. Sem ele, o símbolo é decorativo (`aria-hidden`). */
  rotulo?: string
  /** Sobre fundo lilás (tema claro), a pétala lilás vira branca para continuar visível. */
  sobreLilas?: boolean
}

/**
 * Símbolo da Evolia: quatro pétalas orgânicas (conexão, conhecimento, crescimento e evolução).
 * Lilás no alto à esquerda, rosa no alto à direita, lima embaixo à direita e plum embaixo à
 * esquerda (off-white no tema escuro).
 */
export function SimboloEvolia({ className, variante = 'colorido', rotulo, sobreLilas = false }: Props) {
  const mono = variante === 'monocromatico'
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn('size-8 shrink-0', className)}
      role={rotulo ? 'img' : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
      focusable="false"
    >
      <path d={PETALA} className={mono ? 'fill-current' : sobreLilas ? 'fill-white dark:fill-secondary' : 'fill-secondary'} />
      <path d={PETALA} transform="rotate(90 20 20)" className={mono ? 'fill-current' : 'fill-primary'} />
      <path d={PETALA} transform="rotate(180 20 20)" className={mono ? 'fill-current' : 'fill-highlight'} />
      <path d={PETALA} transform="rotate(270 20 20)" className={mono ? 'fill-current' : 'fill-simbolo-detalhe'} />
    </svg>
  )
}
