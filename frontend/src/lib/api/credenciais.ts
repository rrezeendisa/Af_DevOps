/** Credenciais digitadas pelo usuário. Vivem apenas em memória, dentro de uma sessão da API. */
export type Credenciais = {
  readonly nomeUsuario: string
  readonly senha: string
}

const TAMANHO_BLOCO = 0x8000

/**
 * Monta o cabeçalho HTTP Basic com os bytes UTF-8 de `nome:senha`, como o Spring Security
 * decodifica (`BasicAuthenticationConverter`, charset UTF-8). `btoa` sozinho falharia fora do Latin-1.
 */
export function codificarBasic({ nomeUsuario, senha }: Credenciais): string {
  // RFC 7617: o nome não pode conter ':'; a senha pode.
  if (nomeUsuario === '' || nomeUsuario.includes(':')) {
    throw new TypeError('Nome de usuário inválido para autenticação.')
  }
  const bytes = new TextEncoder().encode(`${nomeUsuario}:${senha}`)
  let binario = ''
  for (let inicio = 0; inicio < bytes.length; inicio += TAMANHO_BLOCO) {
    binario += String.fromCharCode(...bytes.subarray(inicio, inicio + TAMANHO_BLOCO))
  }
  return `Basic ${btoa(binario)}`
}
