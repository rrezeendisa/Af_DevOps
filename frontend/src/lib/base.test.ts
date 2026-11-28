import { describe, expect, it } from 'vitest'
import { ApiError, CODIGOS_ERRO } from './api/erros'
import { ehNaoEncontrado, mensagemDeErro } from './api/mensagens'
import { formatarDataHora, formatarHoras, formatarPercentual, normalizarBusca, valoresDistintos } from './formatacao'
import { lerIdPositivo } from './identificador'

describe('lerIdPositivo', () => {
  it.each([
    ['1', 1],
    ['42', 42],
    ['9007199254740991', Number.MAX_SAFE_INTEGER],
  ])('aceita %j', (valor, esperado) => {
    expect(lerIdPositivo(valor)).toBe(esperado)
  })

  it.each([undefined, null, '', '0', '00', '01', '-1', '+1', '1.5', '1e3', ' 1', '1 ', '0x10', 'abc', '9007199254740992', '99999999999999999999'])(
    'rejeita %j',
    (valor) => {
      expect(lerIdPositivo(valor)).toBeNull()
    },
  )
})

describe('formatação', () => {
  it('formata datas com microssegundos da API', () => {
    expect(formatarDataHora('2026-11-27T18:05:09.123456Z')).toMatch(/^\d{2}\/\d{2}\/\d{4}/)
  })

  it('formata horas e percentuais em pt-BR', () => {
    expect(formatarHoras(1)).toBe('1 hora')
    expect(formatarHoras(1200)).toBe('1.200 horas')
    expect(formatarPercentual(0.5)).toMatch(/50\s?%/)
  })

  it('normaliza busca sem acentos e caixa', () => {
    expect(normalizarBusca('  Educação ÁGIL ')).toBe('educacao agil')
  })

  it('extrai valores distintos em ordem alfabética', () => {
    expect(valoresDistintos(['Tecnologia', 'Educação', 'Tecnologia', 'Ágil'])).toEqual(['Ágil', 'Educação', 'Tecnologia'])
  })
})

describe('mensagemDeErro', () => {
  it('tem texto para todo código documentado', () => {
    for (const codigo of CODIGOS_ERRO) {
      const texto = mensagemDeErro(new ApiError('http', { status: 400, codigo }))
      expect(texto.length).toBeGreaterThan(10)
    }
  })

  it.each([
    [new ApiError('rede'), 'Não foi possível conectar'],
    [new ApiError('tempo-limite'), 'demorou'],
    [new ApiError('resposta-invalida'), 'resposta inesperada'],
    [new ApiError('http', { status: 503 }), 'temporariamente indisponível'],
    [new ApiError('http', { status: 404 }), 'não foi encontrado'],
    [new Error('detalhe interno'), 'Não foi possível concluir'],
  ])('usa texto local seguro para %s', (erro, trecho) => {
    expect(mensagemDeErro(erro)).toContain(trecho)
    expect(mensagemDeErro(erro)).not.toContain('detalhe interno')
  })

  it('identifica 404', () => {
    expect(ehNaoEncontrado(new ApiError('http', { status: 404, codigo: 'CURSO_NAO_ENCONTRADO' }))).toBe(true)
    expect(ehNaoEncontrado(new ApiError('http', { status: 500 }))).toBe(false)
    expect(ehNaoEncontrado(new Error('x'))).toBe(false)
  })
})
