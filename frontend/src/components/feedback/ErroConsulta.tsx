import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { mensagemDeErro } from '@/lib/api/mensagens'
import { MensagemErro } from './MensagemErro'

type Props = {
  erro: unknown
  titulo?: string
  aoTentarNovamente?: () => void
}

/** Erro de carregamento com mensagem segura e ação de nova tentativa manual. */
export function ErroConsulta({ erro, titulo = 'Não foi possível carregar os dados', aoTentarNovamente }: Props) {
  return (
    <div className="grid justify-items-start gap-3">
      <MensagemErro titulo={titulo} className="w-full">
        {mensagemDeErro(erro)}
      </MensagemErro>
      {aoTentarNovamente && (
        <Button variant="outline" onClick={aoTentarNovamente}>
          <RotateCw aria-hidden="true" />
          Tentar novamente
        </Button>
      )}
    </div>
  )
}
