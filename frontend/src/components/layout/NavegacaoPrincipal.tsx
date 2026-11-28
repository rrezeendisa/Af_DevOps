import { LogOut } from 'lucide-react'
import { NavLink } from 'react-router'
import { ROTA_INICIO, rotasDe, rotuloNav } from '@/app/rotas'
import { MarcaEvolia } from '@/components/marca/MarcaEvolia'
import type { TipoConta } from '@/features/auth/identidade'
import { cn } from '@/lib/utils'

type Props = {
  tipoConta: TipoConta
  aoSair(): void
  /** Chamado ao escolher um item (fecha o menu no mobile). */
  aoNavegar?: () => void
}

/** Conteúdo da sidebar: marca, seção “Plataforma” gerada da tabela de rotas e “Sair” no rodapé. */
export function NavegacaoPrincipal({ tipoConta, aoSair, aoNavegar }: Props) {
  return (
    <div className="flex h-full flex-col px-4 pt-6 pb-4">
      <MarcaEvolia className="px-2" />
      <nav aria-label="Navegação principal" className="mt-9 flex-1">
        <p className="px-3 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">Plataforma</p>
        <ul className="mt-3 grid gap-1">
          {rotasDe(tipoConta).map((rota) => {
            const Icone = rota.icone
            return (
              <li key={rota.caminho}>
                <NavLink
                  to={rota.caminho}
                  end={rota.caminho === ROTA_INICIO}
                  onClick={aoNavegar}
                  className={({ isActive }) =>
                    cn(
                      'flex h-11 items-center gap-3 rounded-[10px] px-3 text-[0.9375rem] text-foreground transition-colors outline-none',
                      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                      isActive ? 'bg-selected font-semibold' : 'hover:bg-surface-2',
                    )
                  }
                >
                  <Icone aria-hidden="true" className="size-[1.125rem] shrink-0 text-brand-detail" strokeWidth={1.75} />
                  {rotuloNav(rota, tipoConta)}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>
      <button
        type="button"
        onClick={aoSair}
        className="flex h-11 items-center gap-3 rounded-[10px] px-3 text-[0.9375rem] text-muted-foreground transition-colors outline-none hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <LogOut aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.75} />
        Sair
      </button>
    </div>
  )
}
