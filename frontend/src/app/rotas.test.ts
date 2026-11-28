import { describe, expect, it } from 'vitest'
import type { TipoConta } from '@/features/auth/identidade'
import { destinoAposLogin } from '@/features/auth/destino'
import { podeAcessar, resolverRota, ROTAS, rotasDe, rotuloNav } from './rotas'

const TIPOS: TipoConta[] = ['ADMIN', 'COLABORADOR_INDIVIDUAL', 'COLABORADOR_DEMONSTRACAO']
const ADMINISTRATIVAS = ['/admin/colaboradores', '/admin/contas', '/admin/treinamentos']
const CONTA_INDIVIDUAL = ['/competencias', '/recomendacoes', '/orientacao', '/consentimento']

describe('tabela de rotas', () => {
  it.each([
    ['ADMIN', ['Visão geral', 'Colaboradores', 'Cursos', 'Contas', 'Treinamentos']],
    ['COLABORADOR_INDIVIDUAL', ['Minha área', 'Cursos', 'Competências', 'Recomendações', 'Orientação', 'Consentimento']],
    ['COLABORADOR_DEMONSTRACAO', ['Minha área', 'Cursos']],
  ] as const)('navegação de %s segue o painel', (tipo, esperado) => {
    expect(rotasDe(tipo).map((rota) => rotuloNav(rota, tipo))).toEqual(esperado)
  })

  it('rotas administrativas são exclusivas de ADMIN', () => {
    for (const caminho of ADMINISTRATIVAS) {
      expect(podeAcessar(caminho, 'ADMIN')).toBe(true)
      expect(podeAcessar(caminho, 'COLABORADOR_INDIVIDUAL')).toBe(false)
      expect(podeAcessar(caminho, 'COLABORADOR_DEMONSTRACAO')).toBe(false)
    }
  })

  it('consentimento e IA são exclusivos da conta individual', () => {
    for (const caminho of CONTA_INDIVIDUAL) {
      expect(podeAcessar(caminho, 'COLABORADOR_INDIVIDUAL')).toBe(true)
      expect(podeAcessar(caminho, 'ADMIN')).toBe(false)
      expect(podeAcessar(caminho, 'COLABORADOR_DEMONSTRACAO')).toBe(false)
    }
  })

  it('início e catálogo valem para todos', () => {
    for (const tipo of TIPOS) {
      expect(podeAcessar('/', tipo)).toBe(true)
      expect(podeAcessar('/cursos', tipo)).toBe(true)
    }
  })

  it.each(['/desconhecido', '/admin', '/api/me', '/entrar', '/cursos/1/editar', ''])('nega caminho fora da tabela: %j', (caminho) => {
    for (const tipo of TIPOS) {
      expect(podeAcessar(caminho, tipo)).toBe(false)
    }
  })

  it('detalhes herdam a permissão da rota-mãe', () => {
    expect(podeAcessar('/cursos/3', 'COLABORADOR_DEMONSTRACAO')).toBe(true)
    expect(podeAcessar('/admin/colaboradores/12', 'ADMIN')).toBe(true)
    expect(podeAcessar('/admin/colaboradores/12', 'COLABORADOR_INDIVIDUAL')).toBe(false)
    expect(podeAcessar('/admin/treinamentos/9007199254740991', 'ADMIN')).toBe(true)
  })

  it.each(['/cursos/0', '/cursos/-1', '/cursos/01', '/cursos/abc', '/cursos/1/x', '/cursos/1.5', '/cursos/9007199254740992', '/admin/contas/1', '/1', '/consentimento/1'])(
    'nega detalhe inválido ou inexistente: %j',
    (caminho) => {
      for (const tipo of TIPOS) {
        expect(podeAcessar(caminho, tipo)).toBe(false)
      }
    },
  )

  it('resolve detalhes para a rota-mãe', () => {
    expect(resolverRota('/cursos/7')).toEqual({ rota: expect.objectContaining({ caminho: '/cursos' }), detalhe: true })
    expect(resolverRota('/cursos')).toEqual({ rota: expect.objectContaining({ caminho: '/cursos' }), detalhe: false })
    expect(resolverRota('/cursos/0')).toBeUndefined()
  })

  it('destino após login aceita detalhe permitido e recusa o proibido', () => {
    expect(destinoAposLogin('/admin/treinamentos/3', 'ADMIN', podeAcessar)).toBe('/admin/treinamentos/3')
    expect(destinoAposLogin('/admin/treinamentos/3', 'COLABORADOR_INDIVIDUAL', podeAcessar)).toBe('/')
    expect(destinoAposLogin('/cursos/0', 'ADMIN', podeAcessar)).toBe('/')
  })

  it('caminhos são únicos e começam com /', () => {
    const caminhos = ROTAS.map((rota) => rota.caminho)
    expect(new Set(caminhos).size).toBe(caminhos.length)
    expect(caminhos.every((caminho) => caminho.startsWith('/'))).toBe(true)
  })

  it('toda rota tem descrição e ao menos um tipo de conta', () => {
    for (const rota of ROTAS) {
      expect(rota.descricao.length).toBeGreaterThan(0)
      expect(rota.permitir.length).toBeGreaterThan(0)
    }
  })
})
