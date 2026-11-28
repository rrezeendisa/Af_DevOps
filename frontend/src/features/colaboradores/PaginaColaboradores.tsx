import { Plus, SearchX, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { BarraFiltros } from '@/components/feedback/BarraFiltros'
import { ErroConsulta } from '@/components/feedback/ErroConsulta'
import { EstadoCarregando } from '@/components/feedback/EstadoCarregando'
import { EstadoVazio } from '@/components/feedback/EstadoVazio'
import { MensagemErro } from '@/components/feedback/MensagemErro'
import { Campo } from '@/components/formulario/Campo'
import { CabecalhoPagina } from '@/components/layout/CabecalhoPagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectNativo } from '@/components/ui/select-nativo'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatarData, normalizarBusca, valoresDistintos } from '@/lib/formatacao'
import { useColaboradores, type Colaborador } from './api'
import { FormularioColaborador } from './FormularioColaborador'

function filtrar(lista: readonly Colaborador[], busca: string, departamento: string, cargo: string): Colaborador[] {
  const termo = normalizarBusca(busca)
  return lista
    .filter(
      (colaborador) =>
        (departamento === '' || colaborador.departamento === departamento) &&
        (cargo === '' || colaborador.cargo === cargo) &&
        (termo === '' || normalizarBusca(`${colaborador.nome} ${colaborador.email}`).includes(termo)),
    )
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export default function PaginaColaboradores() {
  const consulta = useColaboradores()
  const [busca, setBusca] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [cargo, setCargo] = useState('')
  const [formularioAberto, setFormularioAberto] = useState(false)
  const [cadastrado, setCadastrado] = useState<Colaborador | null>(null)

  const colaboradores = useMemo(() => consulta.data ?? [], [consulta.data])
  const departamentos = useMemo(() => valoresDistintos(colaboradores.map((c) => c.departamento)), [colaboradores])
  const cargos = useMemo(() => valoresDistintos(colaboradores.map((c) => c.cargo)), [colaboradores])
  const visiveis = useMemo(() => filtrar(colaboradores, busca, departamento, cargo), [colaboradores, busca, departamento, cargo])

  const limparFiltros = () => {
    setBusca('')
    setDepartamento('')
    setCargo('')
  }

  return (
    <div className="grid gap-8 pt-2">
      <CabecalhoPagina
        titulo="Colaboradores"
        descricao="Cadastro e consulta de colaboradores."
        acoes={
          <Button
            onClick={() => {
              setCadastrado(null)
              setFormularioAberto(true)
            }}
          >
            <Plus aria-hidden="true" />
            Cadastrar colaborador
          </Button>
        }
      />

      {cadastrado && (
        <MensagemErro tom="sucesso" titulo="Colaborador cadastrado">
          <strong>{cadastrado.nome}</strong> foi cadastrado.{' '}
          <Link to={`/admin/contas?colaborador=${cadastrado.id}`} className="font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-4">
            Criar conta individual
          </Link>
        </MensagemErro>
      )}

      {consulta.isPending ? (
        <EstadoCarregando texto="Carregando colaboradores…" />
      ) : consulta.isError ? (
        <ErroConsulta erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
      ) : colaboradores.length === 0 ? (
        <EstadoVazio icone={Users} titulo="Nenhum colaborador cadastrado" descricao="Cadastre o primeiro colaborador para começar." />
      ) : (
        <>
          <BarraFiltros
            resumo={`${visiveis.length} de ${colaboradores.length} ${colaboradores.length === 1 ? 'colaborador' : 'colaboradores'}`}
          >
            <Campo rotulo="Buscar">
              <Input type="search" value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Nome ou e-mail" />
            </Campo>
            <Campo rotulo="Departamento">
              <SelectNativo value={departamento} onChange={(evento) => setDepartamento(evento.target.value)}>
                <option value="">Todos</option>
                {departamentos.map((valor) => (
                  <option key={valor} value={valor}>
                    {valor}
                  </option>
                ))}
              </SelectNativo>
            </Campo>
            <Campo rotulo="Cargo">
              <SelectNativo value={cargo} onChange={(evento) => setCargo(evento.target.value)}>
                <option value="">Todos</option>
                {cargos.map((valor) => (
                  <option key={valor} value={valor}>
                    {valor}
                  </option>
                ))}
              </SelectNativo>
            </Campo>
          </BarraFiltros>

          {visiveis.length === 0 ? (
            <EstadoVazio
              icone={SearchX}
              titulo="Nenhum colaborador encontrado"
              descricao="Ajuste a busca ou os filtros."
              acao={
                <Button variant="secondary" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <caption className="sr-only">Colaboradores cadastrados, em ordem alfabética</caption>
                <thead className="border-b border-border bg-surface-2 text-xs tracking-[0.04em] text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium">Nome</th>
                    <th scope="col" className="px-5 py-3 font-medium">E-mail</th>
                    <th scope="col" className="px-5 py-3 font-medium">Cargo</th>
                    <th scope="col" className="px-5 py-3 font-medium">Departamento</th>
                    <th scope="col" className="px-5 py-3 font-medium">Cadastro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visiveis.map((colaborador) => (
                    <tr key={colaborador.id} className="hover:bg-surface-2/60">
                      <th scope="row" className="px-5 py-3.5 font-semibold">
                        <Link
                          to={`/admin/colaboradores/${colaborador.id}`}
                          className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {colaborador.nome}
                        </Link>
                      </th>
                      <td className="px-5 py-3.5 text-muted-foreground">{colaborador.email}</td>
                      <td className="px-5 py-3.5">{colaborador.cargo}</td>
                      <td className="px-5 py-3.5">{colaborador.departamento}</td>
                      <td className="px-5 py-3.5 text-muted-foreground tabular-nums">{formatarData(colaborador.criadoEm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Sheet open={formularioAberto} onOpenChange={setFormularioAberto}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-surface p-6 sm:max-w-lg">
          <SheetHeader className="p-0">
            <SheetTitle className="font-heading text-2xl font-semibold">Cadastrar colaborador</SheetTitle>
            <SheetDescription>Todos os campos são obrigatórios.</SheetDescription>
          </SheetHeader>
          <FormularioColaborador
            aoCancelar={() => setFormularioAberto(false)}
            aoCadastrar={(colaborador) => {
              setFormularioAberto(false)
              setCadastrado(colaborador)
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
