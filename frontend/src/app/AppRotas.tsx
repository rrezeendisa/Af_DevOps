import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { EstadoCarregando } from '@/components/feedback/EstadoCarregando'
import { ROTA_ENTRAR } from '@/features/auth/destino'
import { PaginaEntrar } from '@/features/auth/PaginaEntrar'
import { RotaProtegida } from '@/features/auth/RotaProtegida'
import { FalhaDeRota } from './FalhaDeRota'
import { NaoEncontrada } from './paginas/NaoEncontrada'
import { PaginaPendente } from './paginas/PaginaPendente'
import { ROTAS, ROTA_INICIO, type Rota } from './rotas'
import { useIdDaRota } from './useIdDaRota'

const PaginaLanding = lazy(() => import('@/features/landing/PaginaLanding'))
const AppShell = lazy(() => import('@/components/layout/AppShell').then(({ AppShell }) => ({ default: AppShell })))

/**
 * Telas implementadas, por caminho. As demais rotas da tabela aparecem como pendentes.
 * Páginas de feature entram com `React.lazy`, em chunks separados.
 */
const PAGINAS: Partial<Record<string, ComponentType>> = {
  [ROTA_INICIO]: lazy(() => import('./paginas/Inicio').then(({ Inicio }) => ({ default: Inicio }))),
  '/cursos': lazy(() => import('@/features/cursos/PaginaCursos')),
  '/admin/colaboradores': lazy(() => import('@/features/colaboradores/PaginaColaboradores')),
  '/admin/contas': lazy(() => import('@/features/contas/PaginaContas')),
  '/admin/treinamentos': lazy(() => import('@/features/treinamentos/PaginaTreinamentos')),
  '/consentimento': lazy(() => import('@/features/consentimento/PaginaConsentimento')),
  '/competencias': lazy(() => import('@/features/ia/PaginaCompetencias')),
  '/recomendacoes': lazy(() => import('@/features/ia/PaginaRecomendacoes')),
  '/orientacao': lazy(() => import('@/features/ia/PaginaOrientacao')),
}

/** Páginas de detalhe (`${caminho}/:id`), também carregadas sob demanda. */
const DETALHES: Partial<Record<string, ComponentType<{ id: number }>>> = {
  '/cursos': lazy(() => import('@/features/cursos/PaginaCurso')),
  '/admin/colaboradores': lazy(() => import('@/features/colaboradores/PaginaColaborador')),
  '/admin/treinamentos': lazy(() => import('@/features/treinamentos/PaginaTreinamento')),
}

function Carregando({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <FalhaDeRota key={pathname}>
      <Suspense fallback={<EstadoCarregando texto="Carregando página…" />}>{children}</Suspense>
    </FalhaDeRota>
  )
}

function Pagina({ rota }: { rota: Rota }) {
  const Componente = PAGINAS[rota.caminho]
  return Componente ? (
    <Carregando>
      <Componente />
    </Carregando>
  ) : (
    <PaginaPendente rota={rota} />
  )
}

/** Só renderiza o detalhe com `:id` inteiro positivo seguro; qualquer outro valor é “não encontrada”. */
function Detalhe({ Componente }: { Componente: ComponentType<{ id: number }> }) {
  const id = useIdDaRota()
  if (id === null) {
    return <NaoEncontrada />
  }
  return (
    <Carregando>
      <Componente id={id} />
    </Carregando>
  )
}

export function AppRotas() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Carregando>
            <PaginaLanding />
          </Carregando>
        }
      />
      <Route path={ROTA_ENTRAR} element={<PaginaEntrar />} />
      <Route
        element={
          <RotaProtegida>
            <FalhaDeRota>
              <Suspense fallback={<EstadoCarregando texto="Carregando página…" />}>
                <AppShell />
              </Suspense>
            </FalhaDeRota>
          </RotaProtegida>
        }
      >
        {ROTAS.map((rota) => (
          <Route
            key={rota.caminho}
            path={rota.caminho}
            element={
              <RotaProtegida permitir={rota.permitir}>
                <Pagina rota={rota} />
              </RotaProtegida>
            }
          />
        ))}
        {ROTAS.map((rota) => {
          const Componente = DETALHES[rota.caminho]
          return Componente ? (
            <Route
              key={`${rota.caminho}/:id`}
              path={`${rota.caminho}/:id`}
              element={
                <RotaProtegida permitir={rota.permitir}>
                  <Detalhe Componente={Componente} />
                </RotaProtegida>
              }
            />
          ) : null
        })}
        <Route path="*" element={<NaoEncontrada />} />
      </Route>
    </Routes>
  )
}
