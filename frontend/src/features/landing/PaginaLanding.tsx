import { useEffect } from 'react'
import { Aprendizagem } from './secoes/Aprendizagem'
import { Areas } from './secoes/Areas'
import { Cabecalho } from './secoes/Cabecalho'
import { ComoFunciona } from './secoes/ComoFunciona'
import { Chamada, Rodape } from './secoes/Encerramento'
import { Hero } from './secoes/Hero'
import { Inteligencia } from './secoes/Inteligencia'
import { UsoResponsavel } from './secoes/UsoResponsavel'

/**
 * Landing institucional pública. Aparece sem esperar a verificação de sessão, não faz chamadas
 * próprias e não exibe dados de ninguém: só o texto do acesso muda quando há sessão.
 */
export default function PaginaLanding() {
  useEffect(() => {
    document.title = 'Evolia · Inteligência que desenvolve pessoas'
    const raiz = document.documentElement
    raiz.classList.add('motion-safe:scroll-smooth')
    // A página é carregada sob demanda: uma âncora no endereço é aplicada depois de montar.
    const id = window.location.hash.slice(1)
    if (id) document.getElementById(id)?.scrollIntoView?.()
    return () => raiz.classList.remove('motion-safe:scroll-smooth')
  }, [])

  return (
    <div className="overflow-x-clip">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-[10px] bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Ir para o conteúdo
      </a>
      <Cabecalho />
      <main id="conteudo" tabIndex={-1} className="isolate outline-none">
        <Hero />
        <Areas />
        <ComoFunciona />
        <Aprendizagem />
        <Inteligencia />
        <UsoResponsavel />
        <Chamada />
      </main>
      <Rodape />
    </div>
  )
}
