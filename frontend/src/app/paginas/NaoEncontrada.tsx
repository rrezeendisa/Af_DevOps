import { Compass } from 'lucide-react'
import { Link } from 'react-router'
import { ROTA_INICIO } from '@/app/rotas'
import { EstadoVazio } from '@/components/feedback/EstadoVazio'
import { CabecalhoPagina } from '@/components/layout/CabecalhoPagina'
import { Button } from '@/components/ui/button'

export function NaoEncontrada() {
  return (
    <div className="grid gap-8 pt-2">
      <CabecalhoPagina titulo="Página não encontrada" />
      <EstadoVazio
        icone={Compass}
        titulo="Não encontramos este endereço"
        descricao="Confira o endereço digitado ou volte para o início."
        acao={
          <Button asChild variant="secondary">
            <Link to={ROTA_INICIO}>Voltar ao início</Link>
          </Button>
        }
      />
    </div>
  )
}
