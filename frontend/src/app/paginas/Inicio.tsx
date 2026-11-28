import { ArrowRight, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { Decorativo } from '@/components/arte/Decorativo'
import { MensagemErro } from '@/components/feedback/MensagemErro'
import { AreasDeCompetencia } from '@/components/inicio/AreasDeCompetencia'
import { Banner } from '@/components/inicio/Banner'
import { SLOGAN } from '@/components/marca/MarcaEvolia'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/contexto'
import { PainelAdmin } from '@/features/painel/PainelAdmin'
import { PainelColaborador } from '@/features/painel/PainelColaborador'

const BOTAO = 'h-11 rounded-xl px-5 shadow-neon hover:brightness-105'

export function Inicio() {
  const { estado } = useAuth()
  if (estado.status !== 'autenticado') {
    return null
  }
  const { tipoConta } = estado
  const individual = tipoConta === 'COLABORADOR_INDIVIDUAL'

  return (
    <div className="grid gap-6 pt-1">
      {tipoConta === 'ADMIN' ? (
        <Banner
          tom="admin"
          rotulo="Painel administrativo"
          titulo="Visão geral da Evolia"
          subtitulo="Gerencie pessoas, conhecimento e inteligência artificial."
          acao={
            <Button asChild className={BOTAO}>
              <Link to="/admin/colaboradores" state={{ abrirCadastro: true }}>
                Novo colaborador
                <Plus aria-hidden="true" />
              </Link>
            </Button>
          }
          arte={
            <>
              <Decorativo nome="petalas" movimento="derivar" className="top-1/2 right-10 w-36 -translate-y-1/2 sm:w-48 xl:right-20 xl:w-56" />
              <Decorativo nome="petalas" movimento="balancar" className="right-0 bottom-2 w-16 opacity-60 blur-[2px]" />
              <Decorativo nome="petalas" movimento="flutuar" className="top-3 left-2 w-12 opacity-50 blur-[3px]" />
            </>
          }
        />
      ) : (
        <Banner
          tom="colaborador"
          titulo="Que bom ter você aqui!"
          subtitulo="Descubra novas possibilidades de desenvolvimento."
          acao={
            <Button asChild className={`${BOTAO} bg-linear-to-r from-primary to-neon-violet`}>
              <Link to={individual ? '/competencias' : '/cursos'}>
                {individual ? 'Avaliar competências' : 'Explorar o catálogo'}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          }
          arte={
            <>
              <Decorativo nome="petalas" movimento="balancar" className="bottom-0 left-0 w-24 opacity-80 sm:w-32" />
              <Decorativo nome="mascote" movimento="flutuar" className="top-1/2 right-6 w-28 -translate-y-1/2 sm:w-36 xl:right-20 xl:w-44" />
              <Decorativo nome="petalas" movimento="derivar" className="top-4 right-2 w-12 opacity-60 blur-[2px]" />
            </>
          }
        />
      )}

      {tipoConta === 'COLABORADOR_DEMONSTRACAO' && (
        <MensagemErro tom="aviso" titulo="Conta de demonstração">
          Competências, recomendações, orientação com IA e consentimento estão disponíveis apenas para contas
          individuais. Solicite uma conta individual ao administrador da plataforma.
        </MensagemErro>
      )}

      {tipoConta === 'ADMIN' ? <PainelAdmin /> : <AreasDeCompetencia />}
      {individual && <PainelColaborador />}

      <p className="pt-2 text-center text-sm text-muted-foreground">{SLOGAN}</p>
    </div>
  )
}
