import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('router path helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: {
        href: 'https://example.github.io/MaredeVendas-vanilla/#/dashboard/pedidos',
        hash: '#/dashboard/pedidos',
        pathname: '/MaredeVendas-vanilla/dashboard/pedidos',
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads hash path when history router disabled', async () => {
    vi.resetModules()
    vi.doMock('../js/config.js', () => ({
      APP_BASE_PATH: '',
      USE_HISTORY_ROUTER: false,
    }))
    const { getCurrentPath, routeHref, getHashSection } = await import('../js/router.js')
    expect(getCurrentPath()).toBe('/dashboard/pedidos')
    expect(routeHref('/dashboard')).toBe('#/dashboard')

    window.location.hash = '#/conta/entrar?sec=planos'
    window.location.href = 'https://example.github.io/MaredeVendas-vanilla/#/conta/entrar?sec=planos'
    expect(getCurrentPath()).toBe('/conta/entrar')
    expect(getHashSection()).toBe('planos')

    window.location.href = 'https://example.github.io/MaredeVendas-vanilla/#/admin/entrar'
    window.location.hash = '#/admin/entrar'
    window.location.pathname = '/MaredeVendas-vanilla/'
    expect(getCurrentPath()).toBe('/admin/entrar')
  })
})