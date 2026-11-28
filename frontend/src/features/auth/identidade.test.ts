import { describe, expect, it } from 'vitest'
import { classificarConta, lerIdentidade } from './identidade'

describe('lerIdentidade', () => {
  it.each([
    [{ nomeUsuario: 'admin.demo', perfil: 'ADMIN' }, 'ADMIN'],
    [{ nomeUsuario: 'ana_silva-1', perfil: 'COLABORADOR', colaboradorId: 7 }, 'COLABORADOR_INDIVIDUAL'],
    [{ nomeUsuario: 'colaborador.demo', perfil: 'COLABORADOR' }, 'COLABORADOR_DEMONSTRACAO'],
  ] as const)('aceita %j como %s', (dados, tipo) => {
    expect(classificarConta(lerIdentidade(dados))).toBe(tipo)
  })

  it('descarta campos extras', () => {
    expect(
      lerIdentidade({ nomeUsuario: 'ana', perfil: 'COLABORADOR', colaboradorId: 7, senhaHash: '$2b$12$x', email: 'a@b.c' }),
    ).toEqual({ nomeUsuario: 'ana', perfil: 'COLABORADOR', colaboradorId: 7 })
  })

  it.each([
    ['perfil desconhecido', { nomeUsuario: 'ana', perfil: 'GESTOR' }],
    ['perfil ausente', { nomeUsuario: 'ana' }],
    ['nome ausente', { perfil: 'ADMIN' }],
    ['nome vazio', { nomeUsuario: '', perfil: 'ADMIN' }],
    ['nome com caractere inválido', { nomeUsuario: 'ana silva', perfil: 'ADMIN' }],
    ['nome acima de 64', { nomeUsuario: 'a'.repeat(65), perfil: 'ADMIN' }],
    ['colaboradorId decimal', { nomeUsuario: 'ana', perfil: 'COLABORADOR', colaboradorId: 1.5 }],
    ['colaboradorId zero', { nomeUsuario: 'ana', perfil: 'COLABORADOR', colaboradorId: 0 }],
    ['colaboradorId negativo', { nomeUsuario: 'ana', perfil: 'COLABORADOR', colaboradorId: -3 }],
    ['colaboradorId textual', { nomeUsuario: 'ana', perfil: 'COLABORADOR', colaboradorId: '7' }],
    ['colaboradorId nulo', { nomeUsuario: 'ana', perfil: 'COLABORADOR', colaboradorId: null }],
    ['ADMIN com colaboradorId', { nomeUsuario: 'admin', perfil: 'ADMIN', colaboradorId: 1 }],
    ['corpo não objeto', 'ADMIN'],
    ['corpo nulo', null],
  ])('rejeita %s', (_caso, dados) => {
    expect(() => lerIdentidade(dados)).toThrow()
  })
})
