import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { resolverRota, ROTA_INICIO, rotuloNav } from '@/app/rotas'
import { AlternadorTema } from '@/components/tema/AlternadorTema'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/contexto'
import { JornadaProvider } from '@/features/ia/JornadaProvider'
import { Breadcrumbs, type ItemTrilha } from './Breadcrumbs'
import { NavegacaoPrincipal } from './NavegacaoPrincipal'

/**
 * Estrutura das páginas autenticadas: sidebar fixa a partir de `lg` (Sheet no mobile), cabeçalho
 * com breadcrumbs, tema e usuário, e o conteúdo da rota. Fica sempre dentro de `RotaProtegida`.
 */
export function AppShell() {
  const { estado, sair } = useAuth()
  const { pathname } = useLocation()
  // O menu mobile fica aberto só na rota em que foi aberto: qualquer navegação o fecha.
  const [menuAbertoEm, setMenuAbertoEm] = useState<string | null>(null)
  const menuAberto = menuAbertoEm === pathname
  const setMenuAberto = (aberto: boolean) => setMenuAbertoEm(aberto ? pathname : null)
  const conteudoRef = useRef<HTMLElement>(null)
  // Preferência só em memória: o armazenamento local guarda apenas tema e saída pendente.
  const [recolhida, setRecolhida] = useState(false)
  // Caminho já anunciado. Comparar caminhos (e não um "primeira renderização") evita que a
  // execução dupla de efeitos do StrictMode mova o foco ao montar.
  const caminhoAnunciado = useRef(pathname)
  const resolvida = resolverRota(pathname)
  const trilha: ItemTrilha[] = !resolvida
    ? [{ titulo: 'Página não encontrada' }]
    : resolvida.detalhe && resolvida.rota.detalhe
      ? [{ titulo: resolvida.rota.titulo, caminho: resolvida.rota.caminho }, { titulo: resolvida.rota.detalhe.titulo }]
      : [{ titulo: resolvida.rota.titulo, caminho: resolvida.rota.caminho }]
  const titulo = trilha[trilha.length - 1]?.titulo ?? 'Evolia'

  useEffect(() => {
    document.title = `${titulo} · Evolia`
    // Na troca de rota, a página volta ao topo e o foco vai para o conteúdo, para que leitores de
    // tela anunciem a nova página. `preventScroll` evita esconder o cabeçalho.
    if (caminhoAnunciado.current === pathname) {
      return
    }
    caminhoAnunciado.current = pathname
    window.scrollTo({ top: 0 })
    conteudoRef.current?.focus({ preventScroll: true })
  }, [pathname, titulo])

  if (estado.status !== 'autenticado') {
    return null
  }
  const { identidade, tipoConta } = estado
  const nomeUsuario = identidade.nomeUsuario
  // No início, a trilha usa o nome do item na navegação (“Visão geral” para a administração).
  const itensDaTrilha = resolvida && pathname === ROTA_INICIO ? [{ titulo: rotuloNav(resolvida.rota, tipoConta), caminho: ROTA_INICIO }] : trilha

  return (
    <div className={cn('min-h-svh bg-background lg:grid', recolhida ? 'lg:grid-cols-[5.5rem_1fr]' : 'lg:grid-cols-[16rem_1fr]')}>
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-[10px] bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Ir para o conteúdo
      </a>

      <aside className="sticky top-0 hidden h-svh py-2 pl-2 lg:block">
        <div className="h-full overflow-hidden rounded-3xl border border-border bg-surface shadow-baixa">
          <NavegacaoPrincipal tipoConta={tipoConta} nomeUsuario={nomeUsuario} aoSair={sair} recolhida={recolhida} />
        </div>
      </aside>

      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
        <SheetContent
          side="left"
          className="w-[18rem] max-w-[85vw] bg-surface p-0"
          onOpenAutoFocus={(evento) => {
            // O foco começa na navegação: o primeiro botão do painel é “Sair”.
            evento.preventDefault()
            ;(evento.currentTarget as HTMLElement).querySelector<HTMLElement>('nav a')?.focus()
          }}
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Navegação principal da Evolia</SheetDescription>
          <NavegacaoPrincipal tipoConta={tipoConta} nomeUsuario={nomeUsuario} aoSair={sair} aoNavegar={() => setMenuAberto(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-[4.5rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Abrir menu"
            aria-expanded={menuAberto}
            onClick={() => setMenuAberto(true)}
          >
            <Menu aria-hidden="true" className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            aria-label="Recolher a navegação"
            aria-pressed={recolhida}
            onClick={() => setRecolhida((valor) => !valor)}
          >
            {recolhida ? <PanelLeftOpen aria-hidden="true" className="size-5" /> : <PanelLeftClose aria-hidden="true" className="size-5" />}
          </Button>
          <div className="min-w-0 flex-1">
            <Breadcrumbs itens={itensDaTrilha} raiz={tipoConta === 'ADMIN' ? 'Administração' : 'Minha área'} />
          </div>
          <AlternadorTema />
        </header>
        <main
          id="conteudo"
          ref={conteudoRef}
          tabIndex={-1}
          className="mx-auto w-full max-w-[80rem] flex-1 px-4 pb-12 outline-none sm:px-6 lg:px-8"
        >
          {/* A jornada de IA é recriada a cada sessão: logout e troca de usuário descartam tudo. */}
          <JornadaProvider key={estado.geracao}>
            <Outlet />
          </JornadaProvider>
        </main>
      </div>
    </div>
  )
}
