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

  it('detectAppBasePath ignores SPA path segments on custom domain', async () => {
    vi.stubGlobal('window', { location: { pathname: '/conta/entrar' } })
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

  it('getProductionSiteUrl points to maredevendas.com.br', async () => {
    vi.stubGlobal('window', { location: { pathname: '/' } })
    const { getProductionSiteUrl, isCustomDomainHost } = await import('../js/config.js')
    expect(getProductionSiteUrl()).toBe('https://maredevendas.com.br/')
    expect(isCustomDomainHost('maredevendas.com.br')).toBe(true)
    expect(isCustomDomainHost('www.maredevendas.com.br')).toBe(true)
  })
})