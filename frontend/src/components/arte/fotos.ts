/**
 * Fotografias locais em `src/assets/fotos/`. O que ainda não existir não aparece no mapa e o
 * componente `Foto` mostra o fallback.
 */
const arquivos = import.meta.glob<string>('../../assets/fotos/*.{avif,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})

export type NomeFoto =
  | 'hero-aprendizado'
  | 'hero-colaboracao'
  | 'area-tecnologia'
  | 'area-comunicacao'
  | 'area-logica'
  | 'experiencia-estudo'
  | 'login-acolhimento'
  | 'capa-tecnologia'
  | 'capa-seguranca'
  | 'capa-comunicacao'
  | 'capa-logica'

/** URL da fotografia, preferindo AVIF; `undefined` se não houver arquivo. */
export function urlDaFoto(nome: NomeFoto, disponiveis: Record<string, string> = arquivos): string | undefined {
  for (const extensao of ['avif', 'webp']) {
    const caminho = Object.keys(disponiveis).find((chave) => chave.endsWith(`/${nome}.${extensao}`))
    if (caminho) return disponiveis[caminho]
  }
  return undefined
}
