import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('router path helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: {
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
    const { getCurrentPath, routeHref } = await import('../js/router.js')
    expect(getCurrentPath()).toBe('/dashboard/pedidos')
    expect(routeHref('/dashboard')).toBe('#/dashboard')
  })
})