import { cloneElement, useId, type ReactElement, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'

type PropsControle = {
  id?: string | undefined
  'aria-invalid'?: boolean | undefined
  'aria-describedby'?: string | undefined
}

type Props = {
  rotulo: string
  /** Mensagem de erro do campo. Também marca o controle com `aria-invalid`. */
  erro?: string | undefined
  /** Texto de ajuda exibido abaixo do controle. */
  ajuda?: ReactNode
  /** Um único controle (Input, Textarea, SelectNativo...). Recebe `id`, `aria-invalid` e `aria-describedby`. */
  children: ReactElement<PropsControle>
}

/** Rótulo visível, controle, ajuda e erro ligados para tecnologias assistivas. */
export function Campo({ rotulo, erro, ajuda, children }: Props) {
  const base = useId()
  const id = children.props.id ?? `${base}-campo`
  const idAjuda = ajuda ? `${base}-ajuda` : undefined
  const idErro = erro ? `${base}-erro` : undefined
  const descricao = [idErro, idAjuda].filter(Boolean).join(' ') || undefined

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{rotulo}</Label>
      {cloneElement(children, {
        id,
        'aria-invalid': erro ? true : undefined,
        'aria-describedby': descricao,
      })}
      {erro && (
        <p id={idErro} className="text-sm text-destructive">
          {erro}
        </p>
      )}
      {ajuda && (
        <p id={idAjuda} className="text-sm text-muted-foreground">
          {ajuda}
        </p>
      )}
    </div>
  )
}
