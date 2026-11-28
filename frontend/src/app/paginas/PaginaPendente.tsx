import { Hammer } from 'lucide-react'
import { Link } from 'react-router'
import { ROTA_INICIO, type Rota } from '@/app/rotas'
import { BadgePendente } from '@/components/feedback/BadgeStatus'
import { EstadoVazio } from '@/components/feedback/EstadoVazio'
import { CabecalhoPagina } from '@/components/layout/CabecalhoPagina'
import { Button } from '@/components/ui/button'

/** Tela ainda não implementada. Identificada como pendente e sem nenhum dado simulado. */
export function PaginaPendente({ rota }: { rota: Rota }) {
  return (
    <div className="grid gap-8 pt-2">
      <CabecalhoPagina titulo={rota.titulo} descricao={rota.descricao} selo={<BadgePendente />} />
      <EstadoVazio
        icone={Hammer}
        titulo="Esta área está em desenvolvimento"
        descricao="A tela será liberada nas próximas etapas, integrada aos dados reais da plataforma."
        acao={
          <Button asChild variant="secondary">
            <Link to={ROTA_INICIO}>Voltar ao início</Link>
          </Button>
        }
      />
    </div>
  )
}
