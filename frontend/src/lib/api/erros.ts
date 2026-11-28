import { z } from 'zod'

/** Códigos `problem+json` documentados em API_CONTRACTS.md (seção 7). Outros valores são descartados. */
export const CODIGOS_ERRO = [
  'AUTENTICACAO_NECESSARIA',
  'SESSAO_SUBSTITUIDA',
  'ACESSO_NEGADO',
  'CSRF_INVALIDO',
  'DADOS_INVALIDOS',
  'EMAIL_DUPLICADO',
  'COLABORADOR_NAO_ENCONTRADO',
  'CONTA_DUPLICADA',
  'NOME_USUARIO_INDISPONIVEL',
  'CURSO_NAO_ENCONTRADO',
  'CONSENTIMENTO_IA_NECESSARIO',
  'IA_RESPOSTA_INVALIDA',
  'IA_INDISPONIVEL',
  'IA_TEMPO_LIMITE',
  'FILA_INDISPONIVEL',
  'SOLICITACAO_NAO_ENCONTRADA',
] as const

export type CodigoErro = (typeof CODIGOS_ERRO)[number]

export type TipoFalha = 'http' | 'rede' | 'tempo-limite' | 'cancelado' | 'resposta-invalida'

const MENSAGENS: Record<TipoFalha, string> = {
  http: 'O servidor recusou a solicitação.',
  rede: 'Não foi possível se comunicar com o servidor.',
  'tempo-limite': 'O servidor demorou mais que o esperado.',
  cancelado: 'A solicitação foi cancelada.',
  'resposta-invalida': 'O servidor enviou uma resposta inesperada.',
}

/**
 * Falha de comunicação com a API. Guarda somente dados seguros: o tipo, o status HTTP e um
 * código reconhecido. Não guarda `title`, `detail`, campos extras, cabeçalhos, corpo nem a causa original.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError'
  readonly tipo: TipoFalha
  readonly status: number | undefined
  readonly codigo: CodigoErro | undefined

  constructor(tipo: TipoFalha, detalhes: { status?: number | undefined; codigo?: CodigoErro | undefined } = {}) {
    super(MENSAGENS[tipo])
    this.tipo = tipo
    this.status = detalhes.status
    this.codigo = detalhes.codigo
  }

  toJSON(): { name: string; tipo: TipoFalha; status: number | undefined; codigo: CodigoErro | undefined } {
    return { name: this.name, tipo: this.tipo, status: this.status, codigo: this.codigo }
  }
}

export function ehApiError(valor: unknown): valor is ApiError {
  return valor instanceof ApiError
}

const esquemaProblema = z.object({
  status: z.number().int(),
  codigo: z.enum(CODIGOS_ERRO),
})

/** Tipo de mídia sem parâmetros, em minúsculas (`application/json; charset=utf-8` → `application/json`). */
export function tipoDeMidia(tipoConteudo: string | null): string {
  return (tipoConteudo ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
}

/**
 * Extrai o `codigo` de uma resposta `application/problem+json`. Corpo vazio, malformado, de outro
 * tipo, com status divergente ou com código desconhecido resulta em `undefined`, sem lançar erro.
 */
export function extrairCodigo(status: number, tipoConteudo: string | null, texto: string): CodigoErro | undefined {
  if (tipoDeMidia(tipoConteudo) !== 'application/problem+json' || texto === '') {
    return undefined
  }
  let dados: unknown
  try {
    dados = JSON.parse(texto)
  } catch {
    return undefined
  }
  const problema = esquemaProblema.safeParse(dados)
  return problema.success && problema.data.status === status ? problema.data.codigo : undefined
}
