import { describe, expect, it } from 'vitest'
import { iniciais } from '@/lib/formatacao'
import { capaDoCurso } from './capas'

describe('capa ilustrativa do curso', () => {
  it.each([
    ['Git e GitHub', 'Tecnologia', 'area-tecnologia'],
    ['Segurança da informação no cotidiano', 'Tecnologia', 'capa-seguranca'],
    ['Escrita profissional', 'Comunicação', 'area-comunicacao'],
    ['Tomada de decisão baseada em dados', 'Raciocínio lógico', 'area-logica'],
    ['Curso sem tema', 'Outros', 'experiencia-estudo'],
  ])('%s em %s usa %s', (nome, categoria, foto) => {
    expect(capaDoCurso({ nome, categoria }).foto).toBe(foto)
  })
})

describe('iniciais', () => {
  it.each([
    ['Ana Maria Teste', 'AT'],
    ['élio', 'É'],
    ['  ', ''],
  ])('de %j são %j', (nome, esperado) => {
    expect(iniciais(nome)).toBe(esperado)
  })
})
