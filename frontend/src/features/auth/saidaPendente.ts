/**
 * Marcador de logout ainda não confirmado pelo servidor. É a única exceção, além do tema, à regra de não
 * persistir nada no navegador: guarda somente "true", sem usuário, credencial, token ou contexto.
 * Protege a interface contra restauração silenciosa e não substitui a invalidação no servidor.
 */
export const CHAVE_SAIDA_PENDENTE = 'evolia:logout-pendente'

/** Reserva para quando o `localStorage` falha; vale somente enquanto a página existir. */
let emMemoria = false

export function haSaidaPendente(): boolean {
  try {
    return emMemoria || window.localStorage.getItem(CHAVE_SAIDA_PENDENTE) === 'true'
  } catch {
    return emMemoria
  }
}

export function marcarSaidaPendente(): void {
  try {
    window.localStorage.setItem(CHAVE_SAIDA_PENDENTE, 'true')
  } catch {
    emMemoria = true
  }
}

export function limparSaidaPendente(): void {
  emMemoria = false
  try {
    window.localStorage.removeItem(CHAVE_SAIDA_PENDENTE)
  } catch {
    // Sem armazenamento não há marcador gravado a remover.
  }
}

/**
 * Falso quando não é possível ler e gravar o marcador. Nesse caso não há como saber se um logout ficou
 * sem confirmação, e restaurar uma sessão exige confirmação do usuário.
 */
export function marcadorConfiavel(): boolean {
  try {
    const atual = window.localStorage.getItem(CHAVE_SAIDA_PENDENTE)
    if (atual !== null) return true
    // Testa a gravação com um valor que não significa saída pendente.
    window.localStorage.setItem(CHAVE_SAIDA_PENDENTE, 'false')
    if (window.localStorage.getItem(CHAVE_SAIDA_PENDENTE) === 'false') {
      window.localStorage.removeItem(CHAVE_SAIDA_PENDENTE)
    }
    return true
  } catch {
    return false
  }
}
