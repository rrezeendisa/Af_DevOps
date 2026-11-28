import { Foto } from '@/components/arte/Foto'

/**
 * Escultura das quatro pétalas, com fundo transparente. A mesma imagem é desenhada em duas camadas,
 * separadas na faixa vazia entre a escultura e o pedestal (74,5% da altura): só a escultura levita.
 * Só a camada da escultura leva o texto alternativo. Se a imagem trocar, o corte precisa ser conferido.
 */
const CAMADAS = [
  { nome: 'pedestal', alt: '', recorte: '[clip-path:inset(74.5%_0_0_0)]' },
  {
    nome: 'escultura',
    alt: 'Escultura das quatro pétalas da Evolia em vidro iridescente, com um anel luminoso, sobre um pedestal perolado',
    recorte: '[clip-path:inset(0_0_25.5%_0)] motion-safe:animate-flutuar',
  },
] as const

export function EsculturaHero() {
  return (
    <div className="relative size-full">
      {CAMADAS.map(({ nome, alt, recorte }) => (
        <div key={nome} data-camada={nome} className="absolute inset-0">
          <Foto nome="hero-aprendizado" alt={alt} ajuste="conter" largura={1200} altura={1200} prioridade fallback={null} className={recorte} />
        </div>
      ))}
    </div>
  )
}
