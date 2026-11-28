import { COMPETENCIAS, type Competencias } from './api'

const CENTRO = 60
// O centro fica um pouco acima do meio da área para sobrar espaço aos rótulos de baixo.
const RAIO = 44
/** Ponto do eixo `indice` (três eixos a 120°) para uma nota de 0 a 5. */
function ponto(indice: number, nota: number): string {
  const angulo = (-90 + indice * 120) * (Math.PI / 180)
  const distancia = (RAIO * nota) / 5
  return `${(CENTRO + distancia * Math.cos(angulo)).toFixed(1)},${(CENTRO + distancia * Math.sin(angulo)).toFixed(1)}`
}

/**
 * Radar das três notas informadas. Decorativo: os mesmos números aparecem em texto ao lado.
 * Só atributos SVG (a CSP não permite `style`).
 */
export function RadarNotas({ notas }: { notas: Competencias }) {
  return (
    <svg viewBox="-34 -2 188 108" aria-hidden="true" focusable="false" className="w-52 max-w-full">
      {[1, 2, 3, 4, 5].map((nivel) => (
        <polygon key={nivel} points={[0, 1, 2].map((i) => ponto(i, nivel)).join(' ')} className="fill-none stroke-border" strokeWidth="0.8" />
      ))}
      <polygon points={COMPETENCIAS.map(({ campo }, i) => ponto(i, notas[campo])).join(' ')} className="fill-neon-violet/25 stroke-neon-violet" strokeWidth="2" strokeLinejoin="round" />
      {COMPETENCIAS.map(({ campo }, i) => {
        const [x, y] = ponto(i, notas[campo]).split(',')
        return <circle key={campo} cx={x} cy={y} r="3" className="fill-neon-violet" />
      })}
      {COMPETENCIAS.map(({ campo, rotulo }, i) => {
        const [x, y] = ponto(i, 5).split(',').map(Number) as [number, number]
        // Rótulo fora do triângulo: acima do topo, ao lado e abaixo dos outros dois vértices.
        const deslocamento = [{ x: 0, y: -5 }, { x: 0, y: 11 }, { x: 0, y: 11 }][i]!
        return (
          <text key={campo} x={x + deslocamento.x} y={y + deslocamento.y} textAnchor="middle" className="fill-muted-foreground text-[9px]">
            {rotulo}
          </text>
        )
      })}
    </svg>
  )
}
