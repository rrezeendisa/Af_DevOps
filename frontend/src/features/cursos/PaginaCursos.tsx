import { BookOpen, Plus, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { useAuth } from '@/features/auth/contexto'
import { normalizarBusca, valoresDistintos } from '@/lib/formatacao'
import { NIVEIS_CURSO, ROTULO_NIVEL_CURSO, useCursos, type Curso } from './api'
import { CartaoCurso } from './CartaoCurso'
import { FormularioCurso } from './FormularioCurso'

function filtrar(cursos: readonly Curso[], busca: string, categoria: string, nivel: string): Curso[] {
  const termo = normalizarBusca(busca)
  return cursos.filter(
    (curso) =>
      (categoria === '' || curso.categoria === categoria) &&
      (nivel === '' || curso.nivel === nivel) &&
      (termo === '' || normalizarBusca(`${curso.nome} ${curso.descricao}`).includes(termo)),
  )
}

/** Catálogo de cursos para os três tipos de conta. Cadastro só para ADMIN. */
export default function PaginaCursos() {
  const { estado } = useAuth()
  const ehAdmin = estado.status === 'autenticado' && estado.tipoConta === 'ADMIN'
  const consulta = useCursos()
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [nivel, setNivel] = useState('')
  const [formularioAberto, setFormularioAberto] = useState(false)
  const [cadastrado, setCadastrado] = useState<string | null>(null)

  const cursos = useMemo(() => consulta.data ?? [], [consulta.data])
  const categorias = useMemo(() => valoresDistintos(cursos.map((curso) => curso.categoria)), [cursos])
  const visiveis = useMemo(() => filtrar(cursos, busca, categoria, nivel), [cursos, busca, categoria, nivel])
  const filtrando = busca !== '' || categoria !== '' || nivel !== ''

  const limparFiltros = () => {
    setBusca('')
    setCategoria('')
    setNivel('')
  }

  return (
    <div className="grid gap-8 pt-2">
      <CabecalhoPagina
        titulo="Cursos"
        descricao="Catálogo de cursos da plataforma."
        acoes={
          ehAdmin && (
            <Button
              onClick={() => {
                setCadastrado(null)
                setFormularioAberto(true)
              }}
            >
              <Plus aria-hidden="true" />
              Cadastrar curso
            </Button>
          )
        }
      />

      {cadastrado && (
        <MensagemErro tom="sucesso" titulo="Curso cadastrado">
          <strong>{cadastrado}</strong> já está disponível no catálogo.
        </MensagemErro>
      )}

      {consulta.isPending ? (
        <EstadoCarregando texto="Carregando cursos…" />
      ) : consulta.isError ? (
        <ErroConsulta erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
      ) : cursos.length === 0 ? (
        <EstadoVazio
          icone={BookOpen}
          titulo="Nenhum curso cadastrado"
          descricao={ehAdmin ? 'Cadastre o primeiro curso para montar o catálogo.' : 'Os cursos aparecerão aqui assim que forem cadastrados.'}
        />
      ) : (
        <>
          <BarraFiltros
            resumo={`${visiveis.length} de ${cursos.length} ${cursos.length === 1 ? 'curso' : 'cursos'}`}
          >
            <Campo rotulo="Buscar">
              <Input type="search" value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Nome ou descrição" />
            </Campo>
            <Campo rotulo="Categoria">
              <SelectNativo value={categoria} onChange={(evento) => setCategoria(evento.target.value)}>
                <option value="">Todas</option>
                {categorias.map((valor) => (
                  <option key={valor} value={valor}>
                    {valor}
                  </option>
                ))}
              </SelectNativo>
            </Campo>
            <Campo rotulo="Nível">
              <SelectNativo value={nivel} onChange={(evento) => setNivel(evento.target.value)}>
                <option value="">Todos</option>
                {NIVEIS_CURSO.map((valor) => (
                  <option key={valor} value={valor}>
                    {ROTULO_NIVEL_CURSO[valor]}
                  </option>
                ))}
              </SelectNativo>
            </Campo>
          </BarraFiltros>

          {visiveis.length === 0 ? (
            <EstadoVazio
              icone={SearchX}
              titulo="Nenhum curso encontrado"
              descricao="Ajuste a busca ou os filtros."
              acao={
                filtrando && (
                  <Button variant="secondary" onClick={limparFiltros}>
                    Limpar filtros
                  </Button>
                )
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Cursos">
              {visiveis.map((curso) => (
                <li key={curso.id}>
                  <CartaoCurso curso={curso} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {ehAdmin && (
        <Sheet open={formularioAberto} onOpenChange={setFormularioAberto}>
          <SheetContent side="right" className="w-full overflow-y-auto bg-surface p-6 sm:max-w-lg">
            <SheetHeader className="p-0">
              <SheetTitle className="font-heading text-2xl font-semibold">Cadastrar curso</SheetTitle>
              <SheetDescription>Todos os campos são obrigatórios.</SheetDescription>
            </SheetHeader>
            <FormularioCurso
              aoCancelar={() => setFormularioAberto(false)}
              aoCadastrar={(curso) => {
                setFormularioAberto(false)
                setCadastrado(curso.nome)
              }}
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
