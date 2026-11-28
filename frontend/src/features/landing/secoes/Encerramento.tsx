import { Foto } from '@/components/arte/Foto'
import { MarcaEvolia, SLOGAN } from '@/components/marca/MarcaEvolia'
import { SimboloEvolia } from '@/components/marca/SimboloEvolia'
import { Revelar } from '@/components/motion/Revelar'
import { REPOSITORIO, SECOES } from '../dados'
import { AcaoPrincipal } from './AcaoPrincipal'

export function Chamada() {
  return (
    <section aria-labelledby="titulo-chamada" className="px-3 pb-secao sm:px-6">
      <Revelar>
        <div className="fundo-neon relative mx-auto grid max-w-7xl justify-items-start gap-7 overflow-hidden rounded-4xl border border-border bg-lavagem-lilas px-6 pt-16 pb-60 shadow-neon sm:px-14 sm:pt-24 xl:pb-24">
          {/* Símbolo sempre inteiro e sem rotação: é a assinatura da marca. */}
          <div aria-hidden="true" className="absolute right-6 bottom-6 size-48 sm:right-14 xl:top-1/2 xl:right-20 xl:bottom-auto xl:size-80 xl:-translate-y-1/2">
            <Foto
              nome="petalas-3d"
              alt=""
              ajuste="conter"
              largura={768}
              altura={768}
              fallback={
                <SimboloEvolia
                  sobreLilas
                  className="size-full drop-shadow-[0_20px_34px_rgb(166_108_255/0.5)] [--simbolo-detalhe:var(--color-neon-lime)] dark:[--simbolo-detalhe:var(--foreground)]"
                />
              }
            />
          </div>
          <h2 id="titulo-chamada" className="relative max-w-2xl text-titulo font-semibold">
            Seu próximo passo começa por <em className="font-medium">conhecer</em> onde você está.
          </h2>
          <p className="relative max-w-md text-subtitulo">Entre na plataforma e descubra as possibilidades para o seu desenvolvimento.</p>
          <AcaoPrincipal className="relative shadow-neon" />
        </div>
      </Revelar>
    </section>
  )
}

const LINK = 'rounded-md outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring'

export function Rodape() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="grid content-start gap-4">
          <MarcaEvolia />
          <p className="max-w-xs font-heading text-lg italic">{SLOGAN}</p>
        </div>
        <nav aria-label="Rodapé" className="grid content-start gap-2 text-sm">
          <p className="rotulo-editorial mb-1">Nesta página</p>
          {SECOES.map((secao) => (
            <a key={secao.id} href={`#${secao.id}`} className={LINK}>
              {secao.rotulo}
            </a>
          ))}
        </nav>
        <div className="grid content-start gap-2 text-sm">
          <p className="rotulo-editorial mb-1">O projeto</p>
          <p className="text-muted-foreground">Projeto acadêmico de Engenharia de Computação.</p>
          <a href={REPOSITORIO} target="_blank" rel="noreferrer" className={LINK}>
            Repositório no GitHub<span className="sr-only"> (abre em nova aba)</span>
          </a>
        </div>
      </div>
    </footer>
  )
}
