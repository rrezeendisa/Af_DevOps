import { ArrowRight } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { ROTA_INICIO } from '@/app/rotas'
import { MarcaEvolia, SLOGAN } from '@/components/marca/MarcaEvolia'
import { AlternadorTema } from '@/components/tema/AlternadorTema'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/contexto'
import { ROTA_ENTRAR } from '@/features/auth/destino'

/**
 * Landing pública **provisória** (a definitiva é o Incremento 2 do Design 2.0). Aparece sem esperar a
 * verificação de sessão e não faz chamadas próprias: só o texto do acesso muda quando há sessão.
 */
export default function PaginaLanding() {
  const { estado } = useAuth()
  const autenticado = estado.status === 'autenticado'

  useEffect(() => {
    document.title = 'Evolia · Inteligência que desenvolve pessoas'
  }, [])

  return (
    <div className="textura-grao flex min-h-svh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <MarcaEvolia />
        <AlternadorTema />
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 content-center gap-6 px-5 pb-secao sm:px-8">
        <p className="rotulo-editorial">Educação corporativa</p>
        <h1 className="max-w-3xl text-display font-bold">{SLOGAN}</h1>
        <p className="max-w-xl text-subtitulo text-muted-foreground">
          Conectamos conhecimento, tecnologia e desenvolvimento profissional para transformar a aprendizagem
          corporativa.
        </p>
        <Button asChild size="lg" className="justify-self-start">
          <Link to={autenticado ? ROTA_INICIO : ROTA_ENTRAR}>
            {autenticado ? 'Ir para minha área' : 'Acessar plataforma'}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </main>
    </div>
  )
}
