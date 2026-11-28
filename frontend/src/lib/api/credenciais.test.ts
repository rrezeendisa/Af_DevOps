import { describe, expect, it } from 'vitest'
import { codificarLogin } from './credenciais'

const ler = (corpo: string) => Object.fromEntries(new URLSearchParams(corpo))

describe('codificarLogin', () => {
  it('monta o formulário do login', () => {
    expect(codificarLogin({ nomeUsuario: 'ana', senha: 'senha-segura-1' })).toBe('username=ana&password=senha-segura-1')
  })

  it('preserva acentos, símbolos e separadores em UTF-8', () => {
    const senha = 'çãõ€🔒 senha&=+:%'
    const corpo = codificarLogin({ nomeUsuario: 'ana', senha })
    expect(ler(corpo)).toEqual({ username: 'ana', password: senha })
    expect(corpo).toContain('%C3%A7')
    expect(corpo).not.toContain('ç')
  })

  it.each(['', 'ana:maria'])('rejeita o nome %j', (nomeUsuario) => {
    expect(() => codificarLogin({ nomeUsuario, senha: 'senha-secreta-123' })).toThrow(TypeError)
  })

  it('não inclui a senha na mensagem de erro', () => {
    try {
      codificarLogin({ nomeUsuario: 'a:b', senha: 'senha-secreta-123' })
    } catch (erro) {
      expect(String(erro)).not.toContain('senha-secreta-123')
    }
    expect.assertions(1)
  })
})
