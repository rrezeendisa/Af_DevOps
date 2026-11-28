import { criarSessaoApi, type SessaoApi } from '@/lib/api/cliente'
import { ehApiError } from '@/lib/api/erros'
import { lerIdentidade } from './identidade'
import { haSaidaPendente, limparSaidaPendente, marcarSaidaPendente } from './saidaPendente'

/** Sessão que o cookie do navegador representa agora, ou `null` se o servidor disser que não há. */
async function sessaoDoNavegador(): Promise<SessaoApi | null> {
  const sessao = criarSessaoApi()
  try {
    await sessao.retomar(lerIdentidade)
    return sessao
  } catch (erro) {
    if (ehApiError(erro) && erro.status === 401) return null
    throw erro
  }
}

/**
 * Logout pedido pelo usuário em uma sessão conhecida. Quem chama já gravou o marcador, no próprio clique,
 * e informa se havia outro antes. Rejeita sem confirmação.
 */
export async function sairDaSessao(sessao: SessaoApi, jaPendente: boolean): Promise<void> {
  const resultado = await sessao.encerrarNoServidor()
  // Com a sessão substituída, um marcador anterior pode pertencer a outro logout: ele é preservado.
  if (resultado === 'encerrada' || !jaPendente) {
    limparSaidaPendente()
  }
}

/**
 * Nova tentativa de um logout sem confirmação. Só age enquanto o marcador existir: um login posterior,
 * em qualquer aba, remove o marcador antes de criar a sessão, e essa sessão nunca é encerrada aqui.
 */
export async function repetirSaida(conhecida: SessaoApi | null): Promise<void> {
  if (!haSaidaPendente()) return
  let sessao = conhecida
  if (sessao === null) {
    sessao = await sessaoDoNavegador()
    if (sessao === null) {
      limparSaidaPendente()
      return
    }
    // Conferido de novo depois de ler a identidade, antes de encerrar.
    if (!haSaidaPendente()) return
  }
  if ((await sessao.encerrarNoServidor()) === 'encerrada') {
    limparSaidaPendente()
    return
  }
  // A sessão conhecida foi substituída. Se a saída continuar pendente, a próxima tentativa lê a atual.
  if (haSaidaPendente()) {
    throw new Error('Saída ainda não confirmada.')
  }
}

/** Antes de um login: encerra qualquer sessão que o navegador ainda tenha. Devolve se havia uma. */
export async function encerrarSessaoAnterior(): Promise<boolean> {
  const sessao = await sessaoDoNavegador()
  if (sessao === null) {
    limparSaidaPendente()
    return false
  }
  marcarSaidaPendente()
  if ((await sessao.encerrarNoServidor()) !== 'encerrada') {
    throw new Error('A sessão anterior mudou durante o encerramento.')
  }
  limparSaidaPendente()
  return true
}
