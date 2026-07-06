import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('custom domain base path', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('detectAppBasePath is empty on maredevendas.com.br root', async () => {
    vi.stubGlobal('window', { location: { pathname: '/' } })
    const { detectAppBasePath } = await import('../js/config.js')
    expect(detectAppBasePath()).toBe('')
  })

  it('detectAppBasePath keeps github.io project subfolder', async () => {
    vi.stubGlobal('window', { location: { pathname: '/MaredeVendas-vanilla/' } })
    const { detectAppBasePath } = await import('../js/config.js')
    expect(detectAppBasePath()).toBe('/MaredeVendas-vanilla')
  })

  it('assetHref resolves from domain root without prefix', async () => {
    vi.stubGlobal('window', { location: { pathname: '/' } })
    const { assetHref } = await import('../js/config.js')
    expect(assetHref('images/logo.png')).toBe('/assets/images/logo.png')
  })
})