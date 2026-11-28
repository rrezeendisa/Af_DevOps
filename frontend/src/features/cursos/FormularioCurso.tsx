import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Campo } from '@/components/formulario/Campo'
import { MensagemErro } from '@/components/feedback/MensagemErro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectNativo } from '@/components/ui/select-nativo'
import { Textarea } from '@/components/ui/textarea'
import { ehApiError } from '@/lib/api/erros'
import { mensagemDeErro } from '@/lib/api/mensagens'
import {
  esquemaFormularioCurso,
  NIVEIS_CURSO,
  paraNovoCurso,
  ROTULO_NIVEL_CURSO,
  useCadastrarCurso,
  type Curso,
  type FormularioCurso as Campos,
} from './api'

const VAZIO: Campos = { nome: '', descricao: '', cargaHoraria: '', categoria: '', nivel: '' }

type Props = {
  aoCadastrar(curso: Curso): void
  aoCancelar(): void
}

/** Cadastro de curso (ADMIN). Sem reenvio automático; o botão fica bloqueado durante o envio. */
export function FormularioCurso({ aoCadastrar, aoCancelar }: Props) {
  const cadastro = useCadastrarCurso()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Campos, unknown, Parameters<typeof paraNovoCurso>[0]>({
    resolver: zodResolver(esquemaFormularioCurso),
    defaultValues: VAZIO,
  })

  const aoEnviar = async (dados: Parameters<typeof paraNovoCurso>[0]) => {
    if (cadastro.isPending) {
      return
    }
    try {
      const curso = await cadastro.mutateAsync(paraNovoCurso(dados))
      reset(VAZIO)
      aoCadastrar(curso)
    } catch {
      // O erro fica em `cadastro.error` e é exibido abaixo.
    }
  }

  const erroEnvio = cadastro.error
  const mostrarErro = erroEnvio !== null && !(ehApiError(erroEnvio) && erroEnvio.tipo === 'cancelado')

  return (
    <form noValidate onSubmit={(evento) => void handleSubmit(aoEnviar)(evento)} className="grid gap-5" aria-busy={cadastro.isPending}>
      {mostrarErro && <MensagemErro titulo="Não foi possível cadastrar o curso">{mensagemDeErro(erroEnvio)}</MensagemErro>}
      <Campo rotulo="Nome" erro={errors.nome?.message}>
        <Input autoComplete="off" {...register('nome')} />
      </Campo>
      <Campo rotulo="Descrição" erro={errors.descricao?.message} ajuda="Até 2.000 caracteres.">
        <Textarea rows={5} {...register('descricao')} />
      </Campo>
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo rotulo="Carga horária (horas)" erro={errors.cargaHoraria?.message}>
          <Input inputMode="numeric" autoComplete="off" {...register('cargaHoraria')} />
        </Campo>
        <Campo rotulo="Nível" erro={errors.nivel?.message}>
          <SelectNativo {...register('nivel')}>
            <option value="">Selecione</option>
            {NIVEIS_CURSO.map((nivel) => (
              <option key={nivel} value={nivel}>
                {ROTULO_NIVEL_CURSO[nivel]}
              </option>
            ))}
          </SelectNativo>
        </Campo>
      </div>
      <Campo rotulo="Categoria" erro={errors.categoria?.message}>
        <Input autoComplete="off" {...register('categoria')} />
      </Campo>
      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={aoCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={cadastro.isPending}>
          {cadastro.isPending ? 'Cadastrando…' : 'Cadastrar curso'}
        </Button>
      </div>
    </form>
  )
}
