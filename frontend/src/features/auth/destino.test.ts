import { describe, expect, it, vi } from 'vitest'
import { destinoAposLogin, ROTA_INICIAL } from './destino'

const tudoPermitido = () => true

describe('destinoAposLogin', () => {
  it('aceita caminho interno permitido', () => {
    expect(destinoAposLogin('/admin/colaboradores', 'ADMIN', tudoPermitido)).toBe('/admin/colaboradores')
    expect(destinoAposLogin('/inicio', 'ADMIN', tudoPermitido)).toBe('/inicio')
  })

  it.each([
    undefined,
    null,
    42,
    { pathname: '/admin' },
    '',
    'admin',
    'https://outra.origem/admin',
    'http:/outra.origem',
    'javascript:alert(1)',
    '//outra.origem/admin',
    '/\\outra.origem',
    '/admin\\..\\api',
    '/admin/../api/me',
    '/admin/./x',
    '/%2F%2Foutra.origem',
    '/admin%2F..%2Fapi',
    '/admin?x=1',
    '/admin#x',
    '/admin/',
    '/admin//x',
    ' /admin',
    '/entrar',
    '/api',
    '/api/me',
  ])('rejeita %j e volta para a página inicial', (de) => {
    expect(destinoAposLogin(de, 'ADMIN', tudoPermitido)).toBe(ROTA_INICIAL)
  })

  it('rejeita destino não autorizado para o tipo de conta', () => {
    const podeAcessar = vi.fn((caminho: string, tipo: string) => !(caminho.startsWith('/admin') && tipo !== 'ADMIN'))
    expect(destinoAposLogin('/admin/cursos', 'COLABORADOR_INDIVIDUAL', podeAcessar)).toBe(ROTA_INICIAL)
    expect(destinoAposLogin('/admin/cursos', 'ADMIN', podeAcessar)).toBe('/admin/cursos')
    expect(podeAcessar).toHaveBeenCalledWith('/admin/cursos', 'COLABORADOR_INDIVIDUAL')
  })
})
