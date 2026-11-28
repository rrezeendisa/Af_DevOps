import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, UserPlus, Users } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router'
import { ErroConsulta } from '@/components/feedback/ErroConsulta'
import { EstadoCarregando } from '@/components/feedback/EstadoCarregando'
import { EstadoVazio } from '@/components/feedback/EstadoVazio'
import { MensagemErro } from '@/components/feedback/MensagemErro'
import { Campo } from '@/components/formulario/Campo'
import { CabecalhoPagina } from '@/components/layout/CabecalhoPagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectNativo } from '@/components/ui/select-nativo'
import { useSessaoApi } from '@/features/auth/contexto'
import { useColaboradores, type Colaborador } from '@/features/colaboradores/api'
import { ehApiError } from '@/lib/api/erros'
import { mensagemDeErro } from '@/lib/api/mensagens'
import { formatarDataHora, normalizarBusca } from '@/lib/formatacao'
import { lerIdPositivo } from '@/lib/identificador'
import { criarConta, esquemaFormularioConta, type ContaCriada, type FormularioConta } from './api'

type Resultado = { conta: ContaCriada; colaborador: string }

function FormularioNovaConta({ colaboradores, preSelecionado }: { colaboradores: readonly Colaborador[]; preSelecionado: string }) {
  const { api, chave } = useSessaoApi()
  const queryClient = useQueryClient()
  const [busca, setBusca] = useState('')
  const [senhaVisivel, setSenhaVisivel] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const enviandoRef = useRef(false)

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    setFocus,
    reset,
    control,
    formState: { errors },
  } = useForm<FormularioConta>({
    resolver: zodResolver(esquemaFormularioConta),
    defaultValues: { colaboradorId: preSelecionado, nomeUsuario: '', senhaInicial: '', confirmacaoSenha: '' },
  })

  const selecionado = useWatch({ control, name: 'colaboradorId' })
  const ordenados = useMemo(() => [...colaboradores].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [colaboradores])
  const opcoes = useMemo(() => {
    const termo = normalizarBusca(busca)
    // O colaborador selecionado continua na lista mesmo fora da busca.
    return ordenados.filter(
      (c) => String(c.id) === selecionado || termo === '' || normalizarBusca(`${c.nome} ${c.email}`).includes(termo),
    )
  }, [ordenados, busca, selecionado])

  const aoEnviar = async (dados: FormularioConta) => {
    if (enviandoRef.current) {
      return
    }
    const colaboradorId = lerIdPositivo(dados.colaboradorId)
    const colaborador = colaboradores.find((c) => c.id === colaboradorId)
    if (colaboradorId === null || !colaborador) {
      setError('colaboradorId', { message: 'Selecione o colaborador.' })
      return
    }
    enviandoRef.current = true
    setEnviando(true)
    setErroGeral(null)
    setResultado(null)

    const pendente = criarConta(api, colaboradorId, { nomeUsuario: dados.nomeUsuario, senhaInicial: dados.senhaInicial })
    // A requisição já recebeu o corpo: os campos de senha são apagados sem esperar a resposta.
    setValue('senhaInicial', '')
    setValue('confirmacaoSenha', '')
    setSenhaVisivel(false)

    try {
      const conta = await pendente
      if (api.encerrada) return
      reset({ colaboradorId: '', nomeUsuario: '', senhaInicial: '', confirmacaoSenha: '' })
      setBusca('')
      setResultado({ conta, colaborador: colaborador.nome })
    } catch (erro) {
      // Sessão encerrada (logout, troca de usuário ou 401): nenhum estado da tela é atualizado.
      if (api.encerrada || (ehApiError(erro) && erro.tipo === 'cancelado')) return
      if (ehApiError(erro) && erro.codigo === 'CONTA_DUPLICADA') {
        setError('colaboradorId', { message: mensagemDeErro(erro) })
        setFocus('colaboradorId')
      } else if (ehApiError(erro) && erro.codigo === 'NOME_USUARIO_INDISPONIVEL') {
        setError('nomeUsuario', { message: mensagemDeErro(erro) })
        setFocus('nomeUsuario')
      } else {
        setErroGeral(mensagemDeErro(erro))
        if (ehApiError(erro) && erro.codigo === 'COLABORADOR_NAO_ENCONTRADO') {
          void queryClient.invalidateQueries({ queryKey: [...chave, 'colaboradores'] })
        }
      }
    } finally {
      enviandoRef.current = false
      setEnviando(false)
    }
  }

  const tipoSenha = senhaVisivel ? 'text' : 'password'

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <form
        noValidate
        onSubmit={(evento) => void handleSubmit(aoEnviar)(evento)}
        aria-busy={enviando}
        className="grid content-start gap-5 rounded-3xl border border-border bg-surface shadow-baixa p-6"
      >
        <h2 className="font-sans text-lg font-semibold">Nova conta individual</h2>
        {erroGeral && <MensagemErro titulo="Não foi possível criar a conta">{erroGeral}</MensagemErro>}

        <Campo rotulo="Buscar colaborador">
          <Input type="search" value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Nome ou e-mail" />
        </Campo>
        <Campo rotulo="Colaborador" erro={errors.colaboradorId?.message}>
          <SelectNativo {...register('colaboradorId')}>
            <option value="">Selecione</option>
            {opcoes.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.nome} — {c.email}
              </option>
            ))}
          </SelectNativo>
        </Campo>
        <Campo
          rotulo="Nome de usuário"
          erro={errors.nomeUsuario?.message}
          ajuda="Até 64 letras sem acento, números, pontos, hífens ou sublinhados. Será salvo em minúsculas."
        >
          <Input autoComplete="off" autoCapitalize="none" spellCheck={false} {...register('nomeUsuario')} />
        </Campo>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo rotulo="Senha inicial" erro={errors.senhaInicial?.message}>
            <Input type={tipoSenha} autoComplete="new-password" {...register('senhaInicial')} />
          </Campo>
          <Campo rotulo="Confirmar senha" erro={errors.confirmacaoSenha?.message}>
            <Input type={tipoSenha} autoComplete="new-password" {...register('confirmacaoSenha')} />
          </Campo>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Mínimo de 12 caracteres e até 72 bytes. Por segurança, a senha é apagada após cada envio.
          </p>
          <Button type="button" variant="ghost" size="sm" aria-pressed={senhaVisivel} onClick={() => setSenhaVisivel((v) => !v)}>
            {senhaVisivel ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            Mostrar senhas
          </Button>
        </div>
        <Button type="submit" className="justify-self-end" disabled={enviando}>
          <UserPlus aria-hidden="true" />
          {enviando ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>

      <aside aria-label="Resultado" className="grid content-start gap-4">
        {resultado ? (
          <section className="grid gap-4 rounded-2xl border border-success/40 bg-surface p-6" role="status">
            <h2 className="font-sans text-lg font-semibold">Conta criada</h2>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Nome de usuário</dt>
                <dd className="mt-0.5 font-semibold">{resultado.conta.nomeUsuario}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Colaborador</dt>
                <dd className="mt-0.5 font-semibold">{resultado.colaborador}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Criada em</dt>
                <dd className="mt-0.5 font-semibold">{formatarDataHora(resultado.conta.criadoEm)}</dd>
              </div>
            </dl>
            <p className="text-sm text-muted-foreground">
              Entregue a senha inicial ao colaborador por um canal seguro. Ela não fica registrada na plataforma.
            </p>
          </section>
        ) : (
          <div className="grid gap-3 rounded-2xl bg-surface-2 p-6 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Como funciona</p>
            <p>Cada colaborador pode ter uma conta individual, com acesso ao consentimento e às funcionalidades de IA.</p>
            <p>A plataforma ainda não oferece listagem, edição nem troca de senha de contas.</p>
          </div>
        )}
      </aside>
    </div>
  )
}

export default function PaginaContas() {
  const consulta = useColaboradores()
  const [parametros] = useSearchParams()

  // A pré-seleção vem só da navegação: o valor é validado e precisa existir na lista carregada.
  const idPreSelecionado = lerIdPositivo(parametros.get('colaborador'))
  const preSelecionado =
    idPreSelecionado !== null && consulta.data?.some((c) => c.id === idPreSelecionado) ? String(idPreSelecionado) : ''

  return (
    <div className="grid gap-8 pt-2">
      <CabecalhoPagina titulo="Contas individuais" descricao="Criação de contas de acesso para colaboradores cadastrados." />
      {consulta.isPending ? (
        <EstadoCarregando texto="Carregando colaboradores…" />
      ) : consulta.isError ? (
        <ErroConsulta erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
      ) : consulta.data.length === 0 ? (
        <EstadoVazio
          icone={Users}
          titulo="Nenhum colaborador cadastrado"
          descricao="Cadastre um colaborador antes de criar a conta dele."
          acao={
            <Button asChild variant="secondary">
              <Link to="/admin/colaboradores">Ir para colaboradores</Link>
            </Button>
          }
        />
      ) : (
        <FormularioNovaConta key={preSelecionado} colaboradores={consulta.data} preSelecionado={preSelecionado} />
      )}
    </div>
  )
}
