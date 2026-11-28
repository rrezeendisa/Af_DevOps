import { Menu } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { resolverRota } from '@/app/rotas'
import { AlternadorTema } from '@/components/tema/AlternadorTema'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useAuth } from '@/features/auth/contexto'
import { JornadaProvider } from '@/features/ia/JornadaProvider'
import { Breadcrumbs, type ItemTrilha } from './Breadcrumbs'
import { MenuUsuario } from './MenuUsuario'
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

  return (
    <div className="min-h-svh bg-background lg:grid lg:grid-cols-[17.5rem_1fr]">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-[10px] bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Ir para o conteúdo
      </a>

      <aside className="sticky top-0 hidden h-svh border-r border-border bg-surface lg:block">
        <NavegacaoPrincipal tipoConta={tipoConta} aoSair={sair} />
      </aside>

      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
        <SheetContent side="left" className="w-[18rem] max-w-[85vw] bg-surface p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Navegação principal da Evolia</SheetDescription>
          <NavegacaoPrincipal tipoConta={tipoConta} aoSair={sair} aoNavegar={() => setMenuAberto(false)} />
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
          <div className="min-w-0 flex-1">
            <Breadcrumbs itens={trilha} />
          </div>
          <AlternadorTema />
          <MenuUsuario nomeUsuario={identidade.nomeUsuario} tipoConta={tipoConta} aoSair={sair} />
        </header>
        <main
          id="conteudo"
          ref={conteudoRef}
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 outline-none sm:px-6 lg:px-8"
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
