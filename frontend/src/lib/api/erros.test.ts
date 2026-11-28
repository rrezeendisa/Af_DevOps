import { describe, expect, it } from 'vitest'
import { ApiError, extrairCodigo } from './erros'

const PROBLEMA = 'application/problem+json'

describe('extrairCodigo', () => {
  it('lê o código de um problem+json válido', () => {
    const texto = JSON.stringify({ status: 409, codigo: 'EMAIL_DUPLICADO', title: 'E-mail duplicado' })
    expect(extrairCodigo(409, PROBLEMA, texto)).toBe('EMAIL_DUPLICADO')
    expect(extrairCodigo(409, `${PROBLEMA}; charset=utf-8`, texto)).toBe('EMAIL_DUPLICADO')
  })

  it.each([
    ['corpo vazio', 409, PROBLEMA, ''],
    ['JSON malformado', 409, PROBLEMA, '{"status":409,'],
    ['outro tipo de conteúdo', 409, 'application/json', '{"status":409,"codigo":"EMAIL_DUPLICADO"}'],
    ['sem Content-Type', 409, null, '{"status":409,"codigo":"EMAIL_DUPLICADO"}'],
    ['status divergente', 400, PROBLEMA, '{"status":409,"codigo":"EMAIL_DUPLICADO"}'],
    ['código desconhecido', 409, PROBLEMA, '{"status":409,"codigo":"SEGREDO_INTERNO"}'],
    ['código não textual', 409, PROBLEMA, '{"status":409,"codigo":42}'],
    ['JSON que não é objeto', 409, PROBLEMA, '"EMAIL_DUPLICADO"'],
  ] as const)('retorna undefined para %s', (_caso, status, tipo, texto) => {
    expect(extrairCodigo(status, tipo, texto)).toBeUndefined()
  })
})

describe('ApiError', () => {
  it('serializa somente tipo, status e código', () => {
    const erro = new ApiError('http', { status: 409, codigo: 'EMAIL_DUPLICADO' })
    expect(JSON.parse(JSON.stringify(erro))).toEqual({
      name: 'ApiError',
      tipo: 'http',
      status: 409,
      codigo: 'EMAIL_DUPLICADO',
    })
    expect(erro).toBeInstanceOf(Error)
    expect(erro.cause).toBeUndefined()
  })
})
