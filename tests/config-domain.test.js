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
    vi.stubGlobal('window', { location: { pathname: '/mdv-web/' } })
    const { detectAppBasePath } = await import('../js/config.js')
    expect(detectAppBasePath()).toBe('/mdv-web')
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

  it('storeThemeOnColor picks dark text on yellow and white on blue', async () => {
    vi.stubGlobal('window', { location: { pathname: '/' } })
    const { storeThemeOnColor, storeThemeButtonStyle, getStoreThemeColor } = await import('../js/config.js')
    expect(storeThemeOnColor('#FBD000')).toBe('#1a1a1a')
    expect(storeThemeOnColor('#448AFF')).toBe('#ffffff')
    const yellow = storeThemeButtonStyle(getStoreThemeColor('pixel-yellow'))
    expect(yellow).toContain('background:#FBD000')
    expect(yellow).toContain('color:#1a1a1a')
    const blue = storeThemeButtonStyle('pixel-blue')
    expect(blue).toContain('background:#448AFF')
    expect(blue).toContain('color:#ffffff')
  })
})