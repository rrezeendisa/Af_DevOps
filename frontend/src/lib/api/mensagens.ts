import { ehApiError, type CodigoErro } from './erros'

/** Texto amigável para cada `codigo` documentado (API_CONTRACTS.md, seção 7). */
const POR_CODIGO: Record<CodigoErro, string> = {
  AUTENTICACAO_NECESSARIA: 'Sua sessão foi encerrada. Entre novamente.',
  ACESSO_NEGADO: 'Seu perfil não tem permissão para esta operação.',
  CSRF_INVALIDO: 'Não foi possível confirmar a operação. Tente novamente.',
  DADOS_INVALIDOS: 'Alguns dados não foram aceitos. Revise os campos e tente novamente.',
  EMAIL_DUPLICADO: 'Já existe um colaborador com este e-mail.',
  COLABORADOR_NAO_ENCONTRADO: 'Colaborador não encontrado.',
  CONTA_DUPLICADA: 'Este colaborador já possui uma conta individual.',
  NOME_USUARIO_INDISPONIVEL: 'Este nome de usuário não está disponível.',
  CURSO_NAO_ENCONTRADO: 'Curso não encontrado.',
  CONSENTIMENTO_IA_NECESSARIO: 'Autorize o uso dos seus dados pela IA para continuar.',
  IA_RESPOSTA_INVALIDA: 'O serviço de IA retornou uma resposta inesperada.',
  IA_INDISPONIVEL: 'O serviço de IA está indisponível no momento.',
  IA_TEMPO_LIMITE: 'A IA demorou mais que o esperado. Tente novamente.',
  FILA_INDISPONIVEL: 'A fila de treinamento está indisponível. A solicitação foi registrada como falha.',
  SOLICITACAO_NAO_ENCONTRADA: 'Solicitação não encontrada.',
}

const GENERICA = 'Não foi possível concluir a operação. Tente novamente.'

/** Mensagem segura para exibir ao usuário. Nunca usa `detail` ou `title` do servidor. */
export function mensagemDeErro(erro: unknown): string {
  if (!ehApiError(erro)) {
    return GENERICA
  }
  if (erro.codigo !== undefined) {
    return POR_CODIGO[erro.codigo]
  }
  switch (erro.tipo) {
    case 'rede':
      return 'Não foi possível conectar à Evolia agora. Tente novamente em instantes.'
    case 'tempo-limite':
      return 'O servidor demorou mais que o esperado. Tente novamente.'
    case 'resposta-invalida':
      return 'O servidor enviou uma resposta inesperada. Tente novamente.'
    case 'cancelado':
      return 'A operação foi cancelada.'
    case 'http':
      if (erro.status === 404) return 'O registro não foi encontrado.'
      if (erro.status !== undefined && erro.status >= 500) return 'Serviço temporariamente indisponível. Tente novamente em instantes.'
      return GENERICA
  }
}

/** Indica 404 de um registro, para mostrar “não encontrado” em vez de erro genérico. */
export function ehNaoEncontrado(erro: unknown): boolean {
  return ehApiError(erro) && erro.tipo === 'http' && erro.status === 404
}
