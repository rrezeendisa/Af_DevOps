import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { ROTA_INICIO } from '@/app/rotas'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/contexto'
import { ROTA_ENTRAR } from '@/features/auth/destino'

/** CTA principal: respeita a sessão sem esperar a verificação terminar. */
export function AcaoPrincipal({ tamanho = 'lg', className }: { tamanho?: 'sm' | 'default' | 'lg'; className?: string }) {
  const { estado } = useAuth()
  const autenticado = estado.status === 'autenticado'
  return (
    <Button asChild size={tamanho} className={className}>
      <Link to={autenticado ? ROTA_INICIO : ROTA_ENTRAR}>
        {autenticado ? 'Ir para minha área' : 'Acessar plataforma'}
        <ArrowRight aria-hidden="true" />
      </Link>
    </Button>
  )
}
