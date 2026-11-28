import { Menu } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MarcaEvolia } from '@/components/marca/MarcaEvolia'
import { AlternadorTema } from '@/components/tema/AlternadorTema'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { SECOES } from '../dados'
import { AcaoPrincipal } from './AcaoPrincipal'

const LINK =
  'rounded-md text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring'

export function Cabecalho() {
  const [aberto, setAberto] = useState(false)
  const [rolado, setRolado] = useState(false)
  const destino = useRef<string | null>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const aoRolar = () => setRolado(window.scrollY > 24)
    aoRolar()
    window.addEventListener('scroll', aoRolar, { passive: true })
    return () => window.removeEventListener('scroll', aoRolar)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300',
        rolado ? 'border-border bg-background/95 shadow-baixa backdrop-blur-sm' : 'border-transparent bg-transparent',
      )}
    >
      <div
        className={cn(
          'mx-auto flex max-w-7xl items-center gap-3 px-5 transition-[height] duration-300 sm:px-8',
          rolado ? 'h-16' : 'h-20',
        )}
      >
        <a href="#inicio" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Evolia, voltar ao topo">
          <MarcaEvolia />
        </a>
        <nav aria-label="Seções da página" className="mx-auto hidden gap-7 lg:flex">
          {SECOES.map((secao) => (
            <a key={secao.id} href={`#${secao.id}`} className={LINK}>
              {secao.rotulo}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <AlternadorTema />
          <AcaoPrincipal tamanho="default" className="hidden sm:inline-flex" />
          <Button ref={botaoRef} variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu" aria-expanded={aberto} onClick={() => setAberto(true)}>
            <Menu aria-hidden="true" className="size-5" />
          </Button>
        </div>
      </div>

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent
          side="right"
          className="w-[20rem] max-w-[85vw] gap-8 bg-surface p-6"
          onCloseAutoFocus={(evento) => {
            // O foco volta ao botão do menu ou, se uma seção foi escolhida, vai para ela.
            evento.preventDefault()
            const id = destino.current
            destino.current = null
            if (!id) {
              botaoRef.current?.focus()
              return
            }
            const secao = document.getElementById(id)
            window.history.replaceState(window.history.state, '', `#${id}`)
            secao?.focus({ preventScroll: true })
            secao?.scrollIntoView?.()
          }}
        >
          <SheetTitle className="font-heading text-2xl font-semibold">Menu</SheetTitle>
          <SheetDescription className="sr-only">Seções da página e acesso à plataforma</SheetDescription>
          <nav aria-label="Seções" className="grid gap-1">
            {SECOES.map((secao) => (
              <a
                key={secao.id}
                href={`#${secao.id}`}
                onClick={(evento) => {
                  evento.preventDefault()
                  destino.current = secao.id
                  setAberto(false)
                }}
                className="rounded-lg px-2 py-3 font-heading text-xl outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {secao.rotulo}
              </a>
            ))}
          </nav>
          <AcaoPrincipal />
        </SheetContent>
      </Sheet>
    </header>
  )
}
