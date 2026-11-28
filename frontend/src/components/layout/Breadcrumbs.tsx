import { House } from 'lucide-react'
import { Link } from 'react-router'
import { ROTA_INICIO } from '@/app/rotas'

export type ItemTrilha = { titulo: string; caminho?: string }

type Props = { itens: readonly ItemTrilha[]; /** Nome da área do perfil. */ raiz: string }

const ESTILO_LINK =
  'rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring'

/** “Área / Seção / Página”. O último item é a página atual; os anteriores com caminho viram links. */
export function Breadcrumbs({ itens, raiz }: Props) {
  const noInicio = itens.length === 1 && itens[0]?.caminho === ROTA_INICIO
  return (
    <nav aria-label="Trilha de navegação" className="min-w-0">
      <ol className="flex items-center gap-2 truncate text-[0.9375rem] text-muted-foreground">
        <li className="flex items-center gap-2">
          <House aria-hidden="true" className="size-[1.125rem] shrink-0 text-brand-detail" strokeWidth={1.75} />
          {noInicio ? (
            <span>{raiz}</span>
          ) : (
            <Link to={ROTA_INICIO} className={ESTILO_LINK}>
              {raiz}
            </Link>
          )}
        </li>
        {itens.map((item, indice) => {
          const atual = indice === itens.length - 1
          return (
            <li key={`${item.titulo}-${indice}`} className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true">/</span>
              {atual || !item.caminho ? (
                <span aria-current={atual ? 'page' : undefined} className={atual ? 'truncate font-semibold text-brand-detail' : 'truncate'}>
                  {item.titulo}
                </span>
              ) : (
                <Link to={item.caminho} className={ESTILO_LINK}>
                  {item.titulo}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
