import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('router path helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: {
        href: 'https://example.github.io/mdv-web/#/dashboard/pedidos',
        hash: '#/dashboard/pedidos',
        pathname: '/mdv-web/dashboard/pedidos',
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
    const { getCurrentPath, routeHref, getHashSection, getHashQueryParam } = await import('../js/router.js')
    expect(getCurrentPath()).toBe('/dashboard/pedidos')
    expect(routeHref('/dashboard')).toBe('#/dashboard')

    window.location.hash = '#/conta/entrar?sec=planos'
    window.location.href = 'https://example.github.io/mdv-web/#/conta/entrar?sec=planos'
    expect(getCurrentPath()).toBe('/conta/entrar')
    expect(getHashSection()).toBe('planos')
    expect(getHashQueryParam('sec')).toBe('planos')

    window.location.hash = '#/favoritos?tab=orders'
    window.location.href = 'https://example.github.io/mdv-web/#/favoritos?tab=orders'
    expect(getCurrentPath()).toBe('/favoritos')
    expect(getHashQueryParam('tab')).toBe('orders')

    window.location.href = 'https://example.github.io/mdv-web/#/admin/entrar'
    window.location.hash = '#/admin/entrar'
    window.location.pathname = '/mdv-web/'
    expect(getCurrentPath()).toBe('/admin/entrar')

    window.location.hash = ''
    window.location.href = 'https://example.github.io/mdv-web/'
    window.__MV_INITIAL_ROUTE__ = '/admin/entrar'
    expect(getCurrentPath()).toBe('/admin/entrar')

    window.location.hash = '#/'
    window.location.href = 'https://example.github.io/mdv-web/#/'
    expect(getCurrentPath()).toBe('/')

    delete window.__MV_INITIAL_ROUTE__
  })
})