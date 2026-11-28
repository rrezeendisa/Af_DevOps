import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { EstadoCarregando } from '@/components/feedback/EstadoCarregando'
import { MensagemErro } from '@/components/feedback/MensagemErro'
import { useAuth } from './contexto'
import { ROTA_ENTRAR } from './destino'
import type { TipoConta } from './identidade'

type Props = {
  /** Tipos de conta aceitos. Sem a lista, basta estar autenticado. */
  permitir?: readonly TipoConta[]
  children?: ReactNode
}

/**
 * Guarda de rota por autenticação e tipo de conta. Acesso negado não encerra a sessão.
 */
export function RotaProtegida({ permitir, children }: Props) {
  const { estado } = useAuth()
  const { pathname } = useLocation()

  if (estado.status === 'verificando' || estado.status === 'autenticando') {
    return <EstadoCarregando texto="Verificando acesso…" />
  }
  if (estado.status === 'saindo') {
    return <EstadoCarregando texto="Saindo…" />
  }
  if (estado.status !== 'autenticado') {
    // Só o caminho vai no histórico em memória. Query string e fragmento ficam de fora.
    return <Navigate to={ROTA_ENTRAR} replace state={{ de: pathname }} />
  }
  if (permitir !== undefined && !permitir.includes(estado.tipoConta)) {
    return (
      <div className="pt-2">
        <MensagemErro titulo="Acesso não permitido">Seu perfil não tem acesso a esta área.</MensagemErro>
      </div>
    )
  }
  return children ?? <Outlet />
}
