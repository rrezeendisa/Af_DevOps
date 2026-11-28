import { Link } from 'react-router'
import { ROTA_INICIO } from '@/app/rotas'

export type ItemTrilha = { titulo: string; caminho?: string }

type Props = { itens: readonly ItemTrilha[] }

const ESTILO_LINK =
  'rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring'

/** “Evolia / Seção / Página”. O último item é a página atual; os anteriores com caminho viram links. */
export function Breadcrumbs({ itens }: Props) {
  const noInicio = itens.length === 1 && itens[0]?.caminho === ROTA_INICIO
  return (
    <nav aria-label="Trilha de navegação" className="min-w-0">
      <ol className="flex items-center gap-2 truncate text-[0.9375rem] text-muted-foreground">
        <li>
          {noInicio ? (
            <span>Evolia</span>
          ) : (
            <Link to={ROTA_INICIO} className={ESTILO_LINK}>
              Evolia
            </Link>
          )}
        </li>
        {itens.map((item, indice) => {
          const atual = indice === itens.length - 1
          return (
            <li key={`${item.titulo}-${indice}`} className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true">/</span>
              {atual || !item.caminho ? (
                <span aria-current={atual ? 'page' : undefined} className="truncate">
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
