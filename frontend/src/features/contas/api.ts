import { z } from 'zod'
import type { SessaoApi } from '@/lib/api/cliente'
import { lerIdPositivo } from '@/lib/identificador'
import { dataIso, idEntidade } from '@/lib/validacao'

/** `ContasIndividuais.ContaCriada`: (id, nomeUsuario, perfil, colaboradorId, criadoEm). Sem senha. */
const esquemaContaCriada = z.object({
  id: idEntidade,
  nomeUsuario: z.string(),
  perfil: z.literal('COLABORADOR'),
  colaboradorId: idEntidade,
  criadoEm: dataIso,
})

export type ContaCriada = z.infer<typeof esquemaContaCriada>

export const lerContaCriada = (dados: unknown): ContaCriada => esquemaContaCriada.parse(dados)

const SURROGATE_SOLTO = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

/**
 * Regra de `ContasIndividuais.senhaValida`: pelo menos 12 code points, até 72 bytes em UTF-8,
 * não pode ser só espaços, sem NUL e codificável em UTF-8 (sem surrogates soltos).
 */
export function problemaNaSenha(senha: string): string | null {
  if (senha === '') return 'Informe a senha inicial.'
  if (senha.includes('\u0000') || SURROGATE_SOLTO.test(senha)) return 'A senha contém caracteres inválidos.'
  if (senha.trim() === '') return 'A senha não pode ter apenas espaços.'
  if ([...senha].length < 12) return 'Use pelo menos 12 caracteres.'
  if (new TextEncoder().encode(senha).length > 72) {
    return 'Use no máximo 72 bytes. Letras acentuadas e emojis ocupam mais de um byte.'
  }
  return null
}

/** Formulário de `POST /api/colaboradores/{id}/conta`. A confirmação é só local e nunca é enviada. */
export const esquemaFormularioConta = z
  .object({
    colaboradorId: z.string().refine((valor) => lerIdPositivo(valor) !== null, 'Selecione o colaborador.'),
    nomeUsuario: z
      .string()
      .min(1, 'Informe o nome de usuário.')
      .regex(/^[A-Za-z0-9_.-]{1,64}$/, 'Use até 64 letras sem acento, números, pontos, hífens ou sublinhados.'),
    senhaInicial: z.string().superRefine((senha, contexto) => {
      const problema = problemaNaSenha(senha)
      if (problema) contexto.addIssue({ code: 'custom', message: problema })
    }),
    confirmacaoSenha: z.string().min(1, 'Confirme a senha inicial.'),
  })
  .refine((dados) => dados.senhaInicial === dados.confirmacaoSenha, {
    path: ['confirmacaoSenha'],
    message: 'As senhas não coincidem.',
  })

export type FormularioConta = z.infer<typeof esquemaFormularioConta>

/**
 * Cria a conta. Deliberadamente **fora** do TanStack Query: o cache de mutations guardaria a
 * senha em `variables`. O corpo tem exatamente os dois campos do contrato.
 */
export function criarConta(
  api: SessaoApi,
  colaboradorId: number,
  credenciais: { nomeUsuario: string; senhaInicial: string },
): Promise<ContaCriada> {
  return api.enviar(
    `/api/colaboradores/${colaboradorId}/conta`,
    { nomeUsuario: credenciais.nomeUsuario, senhaInicial: credenciais.senhaInicial },
    lerContaCriada,
  )
}
