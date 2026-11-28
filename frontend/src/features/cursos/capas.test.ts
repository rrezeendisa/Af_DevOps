import { describe, expect, it } from 'vitest'
import { iniciais } from '@/lib/formatacao'
import { urlDaFoto } from '@/components/arte/fotos'
import { capaDoCurso } from './capas'

describe('capa ilustrativa do curso', () => {
  it.each([
    ['Git e GitHub', 'Tecnologia', 'curso-git-github'],
    ['  segurança DA informação no cotidiano ', 'Tecnologia', 'curso-seguranca-informacao'],
    ['Privacidade de dados', 'Tecnologia', 'capa-seguranca'],
    ['Redes de computadores', 'Tecnologia', 'area-tecnologia'],
    ['Escrita profissional', 'Comunicação', 'area-comunicacao'],
    ['Jogos de estratégia', 'Raciocínio lógico', 'area-logica'],
    ['Curso sem tema', 'Outros', 'experiencia-estudo'],
  ])('%s em %s usa %s', (nome, categoria, foto) => {
    expect(capaDoCurso({ nome, categoria }).foto).toBe(foto)
  })
})

describe('capas próprias', () => {
  it.each([
    'Segurança da informação no cotidiano',
    'Banco de dados e SQL',
    'Introdução à arquitetura de software',
    'Fundamentos de desenvolvimento de software',
    'Git e GitHub',
    'Fundamentos da tecnologia digital',
    'Lógica de programação',
    'Tomada de decisão baseada em dados',
    'Resolução estruturada de problemas',
    'Pensamento computacional',
    'Algoritmos e estruturas de dados',
    'Feedback e escuta ativa',
    'Liderança e facilitação de equipes',
    'Apresentações de alto impacto',
  ])('%s tem arquivo de capa', (nome) => {
    const { foto } = capaDoCurso({ nome, categoria: 'Qualquer' })
    expect(foto).toMatch(/^curso-/)
    expect(urlDaFoto(foto)).toBeTruthy()
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
