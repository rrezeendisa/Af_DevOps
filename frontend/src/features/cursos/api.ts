import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { useSessaoApi } from '@/features/auth/contexto'
import { dataIso, idEntidade, inteiroPositivo, textoObrigatorio } from '@/lib/validacao'

/** `NivelCurso.java`. Diferente do nível de competência da IA. */
export const NIVEIS_CURSO = ['BASICO', 'INTERMEDIARIO', 'AVANCADO'] as const
export type NivelCurso = (typeof NIVEIS_CURSO)[number]

export const ROTULO_NIVEL_CURSO: Record<NivelCurso, string> = {
  BASICO: 'Básico',
  INTERMEDIARIO: 'Intermediário',
  AVANCADO: 'Avançado',
}

/** `CursoResponse.java`: (id, nome, descricao, cargaHoraria, categoria, nivel, criadoEm). */
const esquemaCurso = z.object({
  id: idEntidade,
  nome: z.string(),
  descricao: z.string(),
  cargaHoraria: z.number().int().positive(),
  categoria: z.string(),
  nivel: z.enum(NIVEIS_CURSO),
  criadoEm: dataIso,
})

export type Curso = z.infer<typeof esquemaCurso>

export const lerCurso = (dados: unknown): Curso => esquemaCurso.parse(dados)
export const lerCursos = (dados: unknown): Curso[] => z.array(esquemaCurso).parse(dados)

/**
 * Formulário de cadastro, espelhando `CursoRequest.java`: nome até 150, descrição até 2000,
 * carga horária inteira positiva (número JSON), categoria até 100 e nível do enum.
 */
export const esquemaFormularioCurso = z.object({
  nome: textoObrigatorio('o nome do curso', 150),
  descricao: textoObrigatorio('a descrição', 2000),
  cargaHoraria: inteiroPositivo('a carga horária'),
  categoria: textoObrigatorio('a categoria', 100),
  nivel: z.string().pipe(z.enum(NIVEIS_CURSO, { error: 'Selecione o nível.' })),
})

export type FormularioCurso = z.input<typeof esquemaFormularioCurso>

export type NovoCurso = {
  nome: string
  descricao: string
  cargaHoraria: number
  categoria: string
  nivel: NivelCurso
}

/** Converte o formulário validado no corpo exato do `POST /api/cursos`. */
export function paraNovoCurso(formulario: z.output<typeof esquemaFormularioCurso>): NovoCurso {
  return {
    nome: formulario.nome.trim(),
    descricao: formulario.descricao.trim(),
    cargaHoraria: Number(formulario.cargaHoraria.trim()),
    categoria: formulario.categoria.trim(),
    nivel: formulario.nivel,
  }
}

export function useCursos() {
  const { api, chave } = useSessaoApi()
  return useQuery({
    queryKey: [...chave, 'cursos'],
    queryFn: ({ signal }) => api.obter('/api/cursos', lerCursos, { signal }),
  })
}

export function useCurso(id: number) {
  const { api, chave } = useSessaoApi()
  return useQuery({
    queryKey: [...chave, 'cursos', id],
    queryFn: ({ signal }) => api.obter(`/api/cursos/${id}`, lerCurso, { signal }),
  })
}

/** Cadastro (ADMIN). Em sucesso, invalida apenas o prefixo da sessão que fez a chamada. */
export function useCadastrarCurso() {
  const { api, chave } = useSessaoApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (curso: NovoCurso) => api.enviar('/api/cursos', curso, lerCurso),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...chave, 'cursos'] }),
  })
}
