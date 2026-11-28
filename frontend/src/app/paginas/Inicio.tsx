import { ROTA_INICIO, rotasDe } from '@/app/rotas'
import { MensagemErro } from '@/components/feedback/MensagemErro'
import { BannerBoasVindas } from '@/components/inicio/BannerBoasVindas'
import { CartaoAcessoRapido } from '@/components/inicio/CartaoAcessoRapido'
import { SLOGAN } from '@/components/marca/MarcaEvolia'
import { useAuth } from '@/features/auth/contexto'
import { PainelAdmin } from '@/features/painel/PainelAdmin'
import { PainelColaborador } from '@/features/painel/PainelColaborador'

const BANNER = {
  ADMIN: { titulo: 'Gestão que transforma.', subtitulo: 'Educação corporativa inteligente' },
  COLABORADOR: { titulo: 'Aprender é evoluir.', subtitulo: 'Sua jornada de desenvolvimento' },
} as const

export function Inicio() {
  const { estado } = useAuth()
  if (estado.status !== 'autenticado') {
    return null
  }
  const { tipoConta, identidade } = estado
  const banner = tipoConta === 'ADMIN' ? BANNER.ADMIN : BANNER.COLABORADOR
  const atalhos = rotasDe(tipoConta).filter((rota) => rota.caminho !== ROTA_INICIO)

  return (
    <div className="grid gap-10 pt-2">
      <BannerBoasVindas titulo={banner.titulo} subtitulo={banner.subtitulo} />

      <p className="-mt-4 text-base text-muted-foreground">
        Olá, <strong className="font-semibold text-foreground">{identidade.nomeUsuario}</strong>.
      </p>

      {tipoConta === 'COLABORADOR_DEMONSTRACAO' && (
        <MensagemErro tom="aviso" titulo="Conta de demonstração">
          Competências, recomendações, orientação com IA e consentimento estão disponíveis apenas para contas
          individuais. Solicite uma conta individual ao administrador da plataforma.
        </MensagemErro>
      )}

      {tipoConta === 'ADMIN' && <PainelAdmin />}
      {tipoConta === 'COLABORADOR_INDIVIDUAL' && <PainelColaborador />}

      <section aria-labelledby="titulo-acesso-rapido" className="grid gap-5">
        <h2 id="titulo-acesso-rapido" className="font-sans text-xl font-semibold">
          Acesso rápido
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {atalhos.map((rota) => (
            <li key={rota.caminho}>
              <CartaoAcessoRapido rota={rota} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Sobre a Evolia" className="rounded-2xl bg-surface px-6 py-5">
        <p className="text-lg font-semibold text-foreground">{SLOGAN}</p>
        <p className="mt-1 text-base text-muted-foreground">Conhecimento, pessoas e evolução.</p>
      </section>
    </div>
  )
}
