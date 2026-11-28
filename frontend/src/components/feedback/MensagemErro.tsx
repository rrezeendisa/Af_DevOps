import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import type { ReactNode, Ref } from 'react'
import { cn } from '@/lib/utils'

type Tom = 'erro' | 'aviso' | 'sucesso'

type Props = {
  titulo?: string
  children: ReactNode
  /** `erro` anuncia imediatamente (`role="alert"`); `aviso` e `sucesso` são informativos (`role="status"`). */
  tom?: Tom
  className?: string
  ref?: Ref<HTMLDivElement>
}

const ESTILOS: Record<Tom, { caixa: string; icone: string; Icone: typeof Info }> = {
  erro: { caixa: 'border-destructive/40 bg-surface', icone: 'text-destructive', Icone: CircleAlert },
  aviso: { caixa: 'border-border bg-surface-2', icone: 'text-brand-detail', Icone: Info },
  sucesso: { caixa: 'border-success/40 bg-surface', icone: 'text-success', Icone: CircleCheck },
}

/** Mensagem com ícone e texto: o significado nunca depende só da cor. */
export function MensagemErro({ titulo, children, tom = 'erro', className, ref }: Props) {
  const { caixa, icone, Icone } = ESTILOS[tom]
  return (
    <div
      ref={ref}
      role={tom === 'erro' ? 'alert' : 'status'}
      tabIndex={-1}
      className={cn(
        'flex gap-3 rounded-xl border px-4 py-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        caixa,
        className,
      )}
    >
      <Icone aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', icone)} />
      <div className="grid gap-0.5">
        {titulo && <p className="font-semibold">{titulo}</p>}
        <div className="text-muted-foreground [&_strong]:text-foreground">{children}</div>
      </div>
    </div>
  )
}
