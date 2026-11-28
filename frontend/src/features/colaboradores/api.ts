import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { useSessaoApi } from '@/features/auth/contexto'
import { dataIso, idEntidade, textoObrigatorio } from '@/lib/validacao'

/** `ColaboradorResponse.java`: (id, nome, email, cargo, departamento, criadoEm). */
const esquemaColaborador = z.object({
  id: idEntidade,
  nome: z.string(),
  email: z.string(),
  cargo: z.string(),
  departamento: z.string(),
  criadoEm: dataIso,
})

export type Colaborador = z.infer<typeof esquemaColaborador>

export const lerColaborador = (dados: unknown): Colaborador => esquemaColaborador.parse(dados)
export const lerColaboradores = (dados: unknown): Colaborador[] => z.array(esquemaColaborador).parse(dados)

/**
 * Formulário espelhando `ColaboradorRequest.java`: nome até 150, e-mail válido até 254,
 * cargo e departamento até 100, sem texto só de espaços nem NUL. O backend normaliza o e-mail
 * (sem espaços nas pontas, minúsculo) e exige que seja único.
 */
export const esquemaFormularioColaborador = z.object({
  nome: textoObrigatorio('o nome', 150),
  email: z.string().superRefine((valor, contexto) => {
    const email = valor.trim()
    if (email === '') {
      contexto.addIssue({ code: 'custom', message: 'Informe o e-mail.' })
    } else if (email.length > 254) {
      contexto.addIssue({ code: 'custom', message: 'Use no máximo 254 caracteres.' })
    } else if (!z.email().safeParse(email).success) {
      contexto.addIssue({ code: 'custom', message: 'Informe um e-mail válido.' })
    }
  }),
  cargo: textoObrigatorio('o cargo', 100),
  departamento: textoObrigatorio('o departamento', 100),
})

export type FormularioColaborador = z.infer<typeof esquemaFormularioColaborador>

export type NovoColaborador = { nome: string; email: string; cargo: string; departamento: string }

export function paraNovoColaborador(formulario: FormularioColaborador): NovoColaborador {
  return {
    nome: formulario.nome.trim(),
    email: formulario.email.trim().toLowerCase(),
    cargo: formulario.cargo.trim(),
    departamento: formulario.departamento.trim(),
  }
}

export function useColaboradores() {
  const { api, chave } = useSessaoApi()
  return useQuery({
    queryKey: [...chave, 'colaboradores'],
    queryFn: ({ signal }) => api.obter('/api/colaboradores', lerColaboradores, { signal }),
  })
}

export function useColaborador(id: number) {
  const { api, chave } = useSessaoApi()
  return useQuery({
    queryKey: [...chave, 'colaboradores', id],
    queryFn: ({ signal }) => api.obter(`/api/colaboradores/${id}`, lerColaborador, { signal }),
  })
}

export function useCadastrarColaborador() {
  const { api, chave } = useSessaoApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (colaborador: NovoColaborador) => api.enviar('/api/colaboradores', colaborador, lerColaborador),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...chave, 'colaboradores'] }),
  })
}
