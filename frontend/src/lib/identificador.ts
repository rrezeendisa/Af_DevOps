/** Só dígitos, sem zero à esquerda: rejeita 0, negativos, sinais, decimais, espaços e notação científica. */
const PADRAO_ID = /^[1-9][0-9]*$/

/**
 * Converte o identificador de uma rota (`/cursos/:id`) em inteiro positivo seguro para JavaScript.
 * Retorna `null` para qualquer valor fora disso, inclusive acima de `Number.MAX_SAFE_INTEGER`.
 */
export function lerIdPositivo(valor: string | null | undefined): number | null {
  if (typeof valor !== 'string' || !PADRAO_ID.test(valor)) {
    return null
  }
  const numero = Number(valor)
  return Number.isSafeInteger(numero) ? numero : null
}
