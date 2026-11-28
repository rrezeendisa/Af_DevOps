import { Component, type ReactNode } from 'react'
import { MensagemErro } from '@/components/feedback/MensagemErro'
import { Button } from '@/components/ui/button'

export class FalhaDeRota extends Component<{ children: ReactNode }, { falhou: boolean }> {
  override state = { falhou: false }

  static getDerivedStateFromError() {
    return { falhou: true }
  }

  override render() {
    if (!this.state.falhou) return this.props.children

    return (
      <div className="mx-auto grid max-w-xl justify-items-start gap-4 px-4 py-8">
        <MensagemErro titulo="Não foi possível carregar esta página">
          Recarregue a aplicação para tentar novamente.
        </MensagemErro>
        <Button onClick={() => window.location.reload()}>Recarregar aplicação</Button>
      </div>
    )
  }
}
