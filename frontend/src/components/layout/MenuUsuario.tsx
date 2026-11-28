import { LogOut, User } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROTULO_TIPO_CONTA, type TipoConta } from '@/features/auth/identidade'

type Props = { nomeUsuario: string; tipoConta: TipoConta; aoSair(): void }

export function MenuUsuario({ nomeUsuario, tipoConta, aoSair }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Menu do usuário ${nomeUsuario}`}
        className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground transition-colors outline-none hover:bg-[color-mix(in_oklch,var(--accent),var(--foreground)_6%)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <User aria-hidden="true" className="size-5" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 p-1.5">
        <DropdownMenuLabel className="grid gap-0.5 px-2 py-1.5">
          <span className="truncate text-sm font-semibold text-foreground">{nomeUsuario}</span>
          <span className="text-xs font-normal text-muted-foreground">{ROTULO_TIPO_CONTA[tipoConta]}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={aoSair} className="h-9 px-2">
          <LogOut aria-hidden="true" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
