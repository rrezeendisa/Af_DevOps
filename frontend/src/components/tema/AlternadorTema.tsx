import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { PreferenciaTema } from '@/lib/tema'
import { useTema } from './contexto'

const OPCOES: { valor: PreferenciaTema; rotulo: string; Icone: typeof Sun }[] = [
  { valor: 'claro', rotulo: 'Claro', Icone: Sun },
  { valor: 'escuro', rotulo: 'Escuro', Icone: Moon },
  { valor: 'sistema', rotulo: 'Seguir o sistema', Icone: Monitor },
]

function ehPreferencia(valor: string): valor is PreferenciaTema {
  return OPCOES.some((opcao) => opcao.valor === valor)
}

export function AlternadorTema() {
  const { preferencia, tema, definirPreferencia } = useTema()
  const atual = OPCOES.find((opcao) => opcao.valor === preferencia) ?? OPCOES[2]
  const Icone = tema === 'escuro' ? Moon : Sun

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Tema: ${atual?.rotulo ?? 'Seguir o sistema'}`}>
          <Icone aria-hidden="true" className="size-5 text-brand-detail" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={preferencia}
          onValueChange={(valor) => {
            if (ehPreferencia(valor)) definirPreferencia(valor)
          }}
        >
          {OPCOES.map(({ valor, rotulo, Icone: IconeOpcao }) => (
            <DropdownMenuRadioItem key={valor} value={valor}>
              <IconeOpcao aria-hidden="true" className="size-4" />
              {rotulo}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
