import { ArrowLeft, SearchX, UserCog } from 'lucide-react'
import { Link } from 'react-router'
import { ErroConsulta } from '@/components/feedback/ErroConsulta'
import { EstadoCarregando } from '@/components/feedback/EstadoCarregando'
import { EstadoVazio } from '@/components/feedback/EstadoVazio'
import { CabecalhoPagina } from '@/components/layout/CabecalhoPagina'
import { Button } from '@/components/ui/button'
import { ehNaoEncontrado } from '@/lib/api/mensagens'
import { formatarDataHora } from '@/lib/formatacao'
import { useColaborador } from './api'

function Voltar() {
  return (
    <Button asChild variant="ghost" className="justify-self-start px-2">
      <Link to="/admin/colaboradores">
        <ArrowLeft aria-hidden="true" />
        Voltar aos colaboradores
      </Link>
    </Button>
  )
}

export default function PaginaColaborador({ id }: { id: number }) {
  const consulta = useColaborador(id)

  if (consulta.isPending) {
    return <EstadoCarregando texto="Carregando colaborador…" />
  }
  if (consulta.isError) {
    return (
      <div className="grid gap-6 pt-2">
        <Voltar />
        {ehNaoEncontrado(consulta.error) ? (
          <EstadoVazio icone={SearchX} titulo="Colaborador não encontrado" descricao="Confira o endereço ou volte à lista." />
        ) : (
          <ErroConsulta erro={consulta.error} titulo="Não foi possível carregar o colaborador" aoTentarNovamente={() => void consulta.refetch()} />
        )}
      </div>
    )
  }

  const colaborador = consulta.data
  const campos = [
    ['E-mail', colaborador.email],
    ['Cargo', colaborador.cargo],
    ['Departamento', colaborador.departamento],
    ['Cadastrado em', formatarDataHora(colaborador.criadoEm)],
  ] as const

  return (
    <div className="grid gap-8 pt-2">
      <Voltar />
      <CabecalhoPagina
        titulo={colaborador.nome}
        descricao={`${colaborador.cargo} · ${colaborador.departamento}`}
        acoes={
          <Button asChild variant="secondary">
            <Link to={`/admin/contas?colaborador=${colaborador.id}`}>
              <UserCog aria-hidden="true" />
              Criar conta individual
            </Link>
          </Button>
        }
      />
      <dl className="grid gap-5 rounded-2xl border border-border bg-surface p-6 sm:grid-cols-2">
        {campos.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt className="text-sm text-muted-foreground">{rotulo}</dt>
            <dd className="mt-0.5 font-semibold break-words">{valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
