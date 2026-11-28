import { Foto } from '@/components/arte/Foto'
import { cn } from '@/lib/utils'
import { POSES } from './poses'

type Props = {
  /** Qual das imagens oficiais usar. */
  pose?: keyof typeof POSES
  /** Define a largura; a proporção é fixa. */
  className?: string
  /** `true` quando o texto ao lado já diz tudo. */
  decorativo?: boolean
  /** Levitação discreta, desligada com movimento reduzido. */
  flutuar?: boolean
}

/** Robô da Evolia IA, a partir das imagens oficiais. */
export function MascoteEvolia({ pose = 'acenando', className, decorativo = false, flutuar = true }: Props) {
  const { nome, largura, altura, proporcao, descricao } = POSES[pose]
  return (
    <div className={cn(proporcao, 'w-40', className)}>
      <Foto
        nome={nome}
        alt={decorativo ? '' : descricao}
        ajuste="conter"
        largura={largura}
        altura={altura}
        fallback={null}
        className={cn(flutuar && 'motion-safe:animate-flutuar')}
      />
    </div>
  )
}
