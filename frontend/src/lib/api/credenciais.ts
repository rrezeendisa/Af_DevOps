/** Credenciais digitadas pelo usuário. Existem apenas durante o envio do login. */
export type Credenciais = {
  readonly nomeUsuario: string
  readonly senha: string
}

/**
 * Corpo `application/x-www-form-urlencoded` de `POST /api/login`, em UTF-8.
 * Nomes de conta seguem `[A-Za-z0-9_.-]`, portanto vazio ou com ':' nem é enviado.
 */
export function codificarLogin({ nomeUsuario, senha }: Credenciais): string {
  if (nomeUsuario === '' || nomeUsuario.includes(':')) {
    throw new TypeError('Nome de usuário inválido para autenticação.')
  }
  return new URLSearchParams({ username: nomeUsuario, password: senha }).toString()
}
