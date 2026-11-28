import { describe, expect, it } from 'vitest'
import { codificarBasic } from './credenciais'

// Valores esperados calculados com Buffer.from(texto, 'utf8').toString('base64').
describe('codificarBasic', () => {
  it('codifica credenciais ASCII como btoa', () => {
    expect(codificarBasic({ nomeUsuario: 'ana', senha: 'senha-segura-1' })).toBe(
      `Basic ${btoa('ana:senha-segura-1')}`,
    )
  })

  it('codifica senha Unicode em UTF-8', () => {
    expect(codificarBasic({ nomeUsuario: 'ana', senha: 'çãõ€🔒senha' })).toBe(
      'Basic YW5hOsOnw6PDteKCrPCflJJzZW5oYQ==',
    )
  })

  it('preserva ":" na senha', () => {
    expect(codificarBasic({ nomeUsuario: 'ana', senha: 'a:b:c' })).toBe('Basic YW5hOmE6Yjpj')
  })

  it.each(['', 'ana:maria'])('rejeita nome de usuário inválido (%j) sem expor a senha', (nomeUsuario) => {
    expect(() => codificarBasic({ nomeUsuario, senha: 'senha-secreta-123' })).toThrow(TypeError)
    try {
      codificarBasic({ nomeUsuario, senha: 'senha-secreta-123' })
    } catch (erro) {
      expect(String(erro)).not.toContain('senha-secreta-123')
    }
  })
})
