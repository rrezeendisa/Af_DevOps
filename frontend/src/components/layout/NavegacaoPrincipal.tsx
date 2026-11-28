import { LogOut, UserRound } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'
import { ROTA_INICIO, rotasDe, rotuloNav, type Rota } from '@/app/rotas'
import { Decorativo } from '@/components/arte/Decorativo'
import { MarcaEvolia } from '@/components/marca/MarcaEvolia'
import { SimboloMarca } from '@/components/marca/SimboloMarca'
import { ROTULO_TIPO_CONTA, type TipoConta } from '@/features/auth/identidade'
import { cn } from '@/lib/utils'

type Props = {
  tipoConta: TipoConta
  nomeUsuario: string
  aoSair(): void
  /** Chamado ao escolher um item (fecha o menu no mobile). */
  aoNavegar?: () => void
  /** Só ícones; os rótulos continuam disponíveis para leitores de tela. */
  recolhida?: boolean
}

const FOCO = 'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface'

function Grupo({ titulo, rotas, tipoConta, aoNavegar, recolhida }: { titulo: string; rotas: Rota[]; tipoConta: TipoConta; aoNavegar: Props['aoNavegar']; recolhida: boolean }) {
  if (rotas.length === 0) return null
  return (
    <div className="grid gap-2">
      <p className={cn('rotulo-editorial px-3', recolhida && 'sr-only')}>{titulo}</p>
      <ul className="grid gap-1.5">
        {rotas.map((rota) => {
          const Icone = rota.icone
          const rotulo = rotuloNav(rota, tipoConta)
          return (
            <li key={rota.caminho}>
              <NavLink
                to={rota.caminho}
                end={rota.caminho === ROTA_INICIO}
                onClick={aoNavegar}
                title={recolhida ? rotulo : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex h-11 items-center gap-3 rounded-xl px-3 text-[0.9375rem] transition-colors duration-200',
                    FOCO,
                    recolhida && 'justify-center px-0',
                    isActive ? 'bg-selected font-semibold text-brand-detail shadow-baixa' : 'text-foreground hover:bg-surface-2',
                  )
                }
              >
                <Icone aria-hidden="true" className="size-[1.125rem] shrink-0 text-brand-detail" strokeWidth={1.75} />
                <span className={cn(recolhida && 'sr-only')}>{rotulo}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Conteúdo da barra lateral: marca, grupos da tabela de rotas e identificação com “Sair”. */
export function NavegacaoPrincipal({ tipoConta, nomeUsuario, aoSair, aoNavegar, recolhida = false }: Props) {
  const rotas = rotasDe(tipoConta)
  const principais = rotas.filter((rota) => rota.grupo !== 'preferencias')
  const preferencias = rotas.filter((rota) => rota.grupo === 'preferencias')
  const comum = { tipoConta, aoNavegar, recolhida }
  // A decoração fica só na página inicial; nas de uso cotidiano a barra é limpa.
  const decorar = useLocation().pathname === ROTA_INICIO && !recolhida

  return (
    <div className="relative isolate flex h-full flex-col overflow-hidden">
      {decorar && <Decorativo nome="petalas" movimento="balancar" className="bottom-16 -left-20 -z-10 w-52 opacity-60" />}
      <div className={cn('px-6 pt-6', recolhida && 'flex justify-center px-0')}>
        {recolhida ? <SimboloMarca className="size-9" /> : <MarcaEvolia />}
      </div>
      <nav aria-label="Navegação principal" className={cn('mt-8 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 pb-2', recolhida && 'px-2')}>
        <Grupo titulo={tipoConta === 'ADMIN' ? 'Administração' : 'Aprendizagem'} rotas={principais} {...comum} />
        <Grupo titulo="Preferências" rotas={preferencias} {...comum} />
      </nav>
      <div className={cn('flex items-center gap-3 border-t border-border bg-surface/80 px-4 py-3', recolhida && 'flex-col px-2')}>
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <UserRound className="size-5" strokeWidth={1.75} />
        </span>
        <span className={cn('grid min-w-0 flex-1', recolhida && 'sr-only')}>
          <span className="truncate text-sm font-semibold">{nomeUsuario}</span>
          <span className="text-xs leading-snug text-muted-foreground">{ROTULO_TIPO_CONTA[tipoConta]}</span>
        </span>
        <button
          type="button"
          onClick={aoSair}
          title="Sair"
          className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground', FOCO)}
        >
          <LogOut aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.75} />
          <span className="sr-only">Sair</span>
        </button>
      </div>
    </div>
  )
}
