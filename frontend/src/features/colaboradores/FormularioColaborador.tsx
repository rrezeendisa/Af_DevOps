import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Campo } from '@/components/formulario/Campo'
import { MensagemErro } from '@/components/feedback/MensagemErro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ehApiError } from '@/lib/api/erros'
import { mensagemDeErro } from '@/lib/api/mensagens'
import {
  esquemaFormularioColaborador,
  paraNovoColaborador,
  useCadastrarColaborador,
  type Colaborador,
  type FormularioColaborador as Campos,
} from './api'

const VAZIO: Campos = { nome: '', email: '', cargo: '', departamento: '' }

type Props = {
  aoCadastrar(colaborador: Colaborador): void
  aoCancelar(): void
}

export function FormularioColaborador({ aoCadastrar, aoCancelar }: Props) {
  const cadastro = useCadastrarColaborador()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<Campos>({ resolver: zodResolver(esquemaFormularioColaborador), defaultValues: VAZIO })

  const aoEnviar = async (dados: Campos) => {
    if (cadastro.isPending) {
      return
    }
    try {
      const colaborador = await cadastro.mutateAsync(paraNovoColaborador(dados))
      reset(VAZIO)
      aoCadastrar(colaborador)
    } catch (erro) {
      if (ehApiError(erro) && erro.codigo === 'EMAIL_DUPLICADO') {
        setError('email', { message: mensagemDeErro(erro) })
        setFocus('email')
      }
    }
  }

  const erro = cadastro.error
  const mostrarErroGeral =
    erro !== null && !(ehApiError(erro) && (erro.tipo === 'cancelado' || erro.codigo === 'EMAIL_DUPLICADO'))

  return (
    <form noValidate onSubmit={(evento) => void handleSubmit(aoEnviar)(evento)} className="grid gap-5" aria-busy={cadastro.isPending}>
      {mostrarErroGeral && <MensagemErro titulo="Não foi possível cadastrar o colaborador">{mensagemDeErro(erro)}</MensagemErro>}
      <Campo rotulo="Nome" erro={errors.nome?.message}>
        <Input autoComplete="off" {...register('nome')} />
      </Campo>
      <Campo rotulo="E-mail" erro={errors.email?.message} ajuda="Deve ser único na plataforma.">
        <Input type="email" autoComplete="off" spellCheck={false} {...register('email')} />
      </Campo>
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo rotulo="Cargo" erro={errors.cargo?.message}>
          <Input autoComplete="off" {...register('cargo')} />
        </Campo>
        <Campo rotulo="Departamento" erro={errors.departamento?.message}>
          <Input autoComplete="off" {...register('departamento')} />
        </Campo>
      </div>
      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={aoCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={cadastro.isPending}>
          {cadastro.isPending ? 'Cadastrando…' : 'Cadastrar colaborador'}
        </Button>
      </div>
    </form>
  )
}
