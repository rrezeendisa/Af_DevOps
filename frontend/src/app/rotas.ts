import {
  BookOpen,
  ChartNoAxesColumn,
  House,
  MessageCircle,
  ShieldCheck,
  Sparkle,
  Sparkles,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { TipoConta } from '@/features/auth/identidade'
import { lerIdPositivo } from '@/lib/identificador'

export type TomRota = 'rosa' | 'lima' | 'lilas'

export type Rota = {
  caminho: string
  /** Título da página e dos breadcrumbs. */
  titulo: string
  /** Rótulo na sidebar, quando difere do título (pode variar por tipo de conta). */
  rotuloNav?: string | Partial<Record<TipoConta, string>>
  icone: LucideIcon
  permitir: readonly TipoConta[]
  situacao: 'disponivel' | 'pendente'
  /** O que a tela fará, com base na API existente. Exibido em telas e atalhos pendentes. */
  descricao: string
  /** Cor do ladrilho do ícone no acesso rápido. */
  tom: TomRota
  /** Itens de preferência ficam num grupo próprio na navegação. */
  grupo?: 'preferencias'
  /** Página de detalhe em `${caminho}/:id`, com a mesma permissão da rota-mãe. */
  detalhe?: { titulo: string }
}

const TODAS: readonly TipoConta[] = ['ADMIN', 'COLABORADOR_INDIVIDUAL', 'COLABORADOR_DEMONSTRACAO']
const ADMIN: readonly TipoConta[] = ['ADMIN']
const INDIVIDUAL: readonly TipoConta[] = ['COLABORADOR_INDIVIDUAL']

/** Página inicial autenticada. `/` é a landing pública e não entra nesta tabela. */
export const ROTA_INICIO = '/inicio'

/**
 * Tabela central de navegação e permissões. A ordem define a ordem da sidebar e do acesso rápido.
 * Toda permissão de rota sai daqui: sidebar, breadcrumbs, acesso rápido, `RotaProtegida` e
 * `destinoAposLogin`. As permissões espelham `SegurancaConfig.java` (API_CONTRACTS.md, seção 4).
 */
export const ROTAS: readonly Rota[] = [
  {
    caminho: ROTA_INICIO,
    titulo: 'Início',
    rotuloNav: { ADMIN: 'Visão geral' },
    icone: House,
    permitir: TODAS,
    situacao: 'disponivel',
    descricao: 'Ponto de partida da plataforma.',
    tom: 'lilas',
  },
  {
    caminho: '/admin/colaboradores',
    titulo: 'Colaboradores',
    icone: Users,
    permitir: ADMIN,
    situacao: 'disponivel',
    descricao: 'Cadastro e consulta de colaboradores.',
    tom: 'rosa',
    detalhe: { titulo: 'Detalhes do colaborador' },
  },
  {
    caminho: '/cursos',
    titulo: 'Cursos',
    rotuloNav: { COLABORADOR_INDIVIDUAL: 'Catálogo de cursos', COLABORADOR_DEMONSTRACAO: 'Catálogo de cursos' },
    icone: BookOpen,
    permitir: TODAS,
    situacao: 'disponivel',
    descricao: 'Catálogo de cursos da plataforma.',
    tom: 'lilas',
    detalhe: { titulo: 'Detalhes do curso' },
  },
  {
    caminho: '/competencias',
    titulo: 'Minhas competências',
    icone: ChartNoAxesColumn,
    permitir: INDIVIDUAL,
    situacao: 'disponivel',
    descricao: 'Avaliação de lógica, comunicação e tecnologia, com classificação do nível por Machine Learning.',
    tom: 'rosa',
  },
  {
    caminho: '/recomendacoes',
    titulo: 'Recomendações',
    icone: Sparkles,
    permitir: INDIVIDUAL,
    situacao: 'disponivel',
    descricao: 'Cursos recomendados para o seu nível, com justificativas e fontes.',
    tom: 'lima',
  },
  {
    caminho: '/admin/contas',
    titulo: 'Contas individuais',
    rotuloNav: 'Contas',
    icone: UserCog,
    permitir: ADMIN,
    situacao: 'disponivel',
    descricao: 'Criação de contas individuais de acesso para colaboradores cadastrados.',
    tom: 'lima',
  },
  {
    caminho: '/admin/treinamentos',
    titulo: 'Treinamentos',
    rotuloNav: 'Treinamentos da IA',
    icone: Sparkle,
    permitir: ADMIN,
    situacao: 'disponivel',
    descricao: 'Solicitação e acompanhamento de treinamentos do modelo de classificação.',
    tom: 'rosa',
    detalhe: { titulo: 'Detalhes da solicitação' },
  },
  {
    caminho: '/orientacao',
    titulo: 'Orientador Evolia',
    icone: MessageCircle,
    permitir: INDIVIDUAL,
    situacao: 'disponivel',
    descricao: 'Orientação personalizada com IA, com cursos sugeridos e próximos passos quando disponíveis.',
    tom: 'rosa',
  },
  {
    caminho: '/consentimento',
    titulo: 'Consentimento',
    rotuloNav: 'Privacidade e IA',
    grupo: 'preferencias',
    icone: ShieldCheck,
    permitir: INDIVIDUAL,
    situacao: 'disponivel',
    descricao: 'Autorização, consulta e revogação do uso dos seus dados pela IA.',
    tom: 'lilas',
  },
]

export function rotaPorCaminho(caminho: string): Rota | undefined {
  return ROTAS.find((rota) => rota.caminho === caminho)
}

export type RotaResolvida = { rota: Rota; detalhe: boolean }

/**
 * Resolve o caminho exato de uma rota ou o detalhe `${caminho}/:id`, com `id` inteiro positivo
 * seguro. Qualquer outro caminho retorna `undefined`.
 */
export function resolverRota(caminho: string): RotaResolvida | undefined {
  const exata = rotaPorCaminho(caminho)
  if (exata) {
    return { rota: exata, detalhe: false }
  }
  const barra = caminho.lastIndexOf('/')
  const mae = rotaPorCaminho(caminho.slice(0, barra))
  if (mae?.detalhe && mae.caminho !== ROTA_INICIO && lerIdPositivo(caminho.slice(barra + 1)) !== null) {
    return { rota: mae, detalhe: true }
  }
  return undefined
}

/** Permissão por caminho (exato ou detalhe). Caminho desconhecido é negado. Usado por `destinoAposLogin`. */
export function podeAcessar(caminho: string, tipoConta: TipoConta): boolean {
  return resolverRota(caminho)?.rota.permitir.includes(tipoConta) ?? false
}

export function rotasDe(tipoConta: TipoConta): Rota[] {
  return ROTAS.filter((rota) => rota.permitir.includes(tipoConta))
}

export function rotuloNav(rota: Rota, tipoConta: TipoConta): string {
  if (typeof rota.rotuloNav === 'string') {
    return rota.rotuloNav
  }
  return rota.rotuloNav?.[tipoConta] ?? rota.titulo
}
