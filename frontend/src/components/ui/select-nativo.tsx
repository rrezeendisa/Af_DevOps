import { ChevronDown } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

/** `<select>` nativo com o visual dos campos da Evolia: acessível e sem dependências. */
function SelectNativo({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="select-nativo"
        className={cn(
          'h-10 w-full min-w-0 appearance-none rounded-[10px] border border-input bg-surface py-2 pr-10 pl-3 text-base text-foreground transition-colors outline-none md:text-sm',
          'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-2 aria-invalid:border-destructive',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}

export { SelectNativo }
