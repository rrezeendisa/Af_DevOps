import { z } from 'zod'

/**
 * Contrato de `GET /api/me` (`IdentidadeController.IdentidadeResponse`, `@JsonInclude(NON_NULL)`).
 * Nomes de conta seguem `[A-Za-z0-9_.-]{1,64}` (`ContasIndividuais` e `ContasDemonstracao`).
 * `colaboradorId` só existe em conta individual, nunca para ADMIN. Campos extras são descartados.
 */
const esquemaIdentidade = z
  .object({
    nomeUsuario: z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/),
    perfil: z.enum(['ADMIN', 'COLABORADOR']),
    colaboradorId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  })
  .refine((identidade) => identidade.perfil === 'COLABORADOR' || identidade.colaboradorId === undefined)

export type Identidade = z.infer<typeof esquemaIdentidade>

export type TipoConta = 'ADMIN' | 'COLABORADOR_INDIVIDUAL' | 'COLABORADOR_DEMONSTRACAO'

/**
 * Validador para `SessaoApi.obter`. Ao falhar, lança erro que o cliente converte em `resposta-invalida`
 * sem anexar o original, que poderia citar os valores recebidos.
 */
export function lerIdentidade(dados: unknown): Identidade {
  return esquemaIdentidade.parse(dados)
}

export function classificarConta(identidade: Identidade): TipoConta {
  if (identidade.perfil === 'ADMIN') {
    return 'ADMIN'
  }
  return identidade.colaboradorId === undefined ? 'COLABORADOR_DEMONSTRACAO' : 'COLABORADOR_INDIVIDUAL'
}

export const ROTULO_TIPO_CONTA: Record<TipoConta, string> = {
  ADMIN: 'Administrador',
  COLABORADOR_INDIVIDUAL: 'Colaborador',
  COLABORADOR_DEMONSTRACAO: 'Conta de demonstração',
}
