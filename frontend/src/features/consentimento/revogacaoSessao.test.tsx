import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { criarFetch, ME, preencherLogin, renderizarApp } from '@/test/app'
import { responderJson as json, servidorSimulado } from '@/test/servidor'

// Respostas simuladas existem somente nestes testes.

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('revogação de consentimento com sessão', () => {
  it('envia o contexto do login e um CSRF novo, e continua autenticado', async () => {
    const servidor = servidorSimulado(criarFetch(), {
      ana: { me: ME.COLABORADOR_INDIVIDUAL, senha: 'senha-de-teste-1' },
    })
    let autorizado = true
    const decisao = () => json({ autorizado, decididoEm: '2026-11-27T10:00:00Z' })
    servidor.interceptar('GET /api/me/consentimento', decisao)
    servidor.interceptar('PUT /api/me/consentimento', () => {
      autorizado = false
      return decisao()
    })
    const { usuario } = renderizarApp('/consentimento')
    await screen.findByRole('heading', { level: 1, name: 'Entrar' })
    await preencherLogin(usuario, 'ana')

    await usuario.click(await screen.findByRole('button', { name: 'Revogar autorização' }))
    await usuario.click(screen.getByRole('button', { name: 'Confirmar revogação' }))

    expect(await screen.findByRole('button', { name: 'Autorizar uso da IA' })).toBeInTheDocument()
    const put = servidor.da('PUT /api/me/consentimento')
    expect(put).toHaveLength(1)
    expect(put[0]).toMatchObject({ contexto: servidor.atual?.contexto, csrf: 'tokenCsrfDeTeste' })
    expect(put[0]?.corpo).toBe('{"autorizado":false}')
    // A releitura posterior é feita no servidor, com o mesmo contexto.
    await waitFor(() => expect(servidor.da('GET /api/me/consentimento').length).toBeGreaterThan(1))
    expect(servidor.da('POST /api/login')).toHaveLength(1)
  })
})
