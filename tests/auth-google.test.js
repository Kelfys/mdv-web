import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('google auth', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: {
        origin: 'https://example.github.io',
        pathname: '/MaredeVendas-vanilla/',
        hash: '#/conta/criar',
      },
    })
    vi.stubGlobal('sessionStorage', {
      setItem: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
    })
    vi.stubGlobal('document', {
      getElementById: () => ({ innerHTML: '' }),
      createElement: () => ({ innerHTML: '' }),
    })
    vi.stubGlobal('requestAnimationFrame', (fn) => fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('getAuthRedirectUrl points to auth callback hash route (GitHub Pages subpath)', async () => {
    vi.doMock('../js/db.js', () => ({
      requireClient: vi.fn(),
      isSupabaseConfigured: () => true,
      getSupabase: vi.fn(),
    }))
    const { getAuthRedirectUrl } = await import('../js/api.js')
    expect(getAuthRedirectUrl()).toBe('https://example.github.io/MaredeVendas-vanilla/#/auth/callback')
  })

  it('getAuthRedirectUrl stays on custom domain host', async () => {
    vi.stubGlobal('window', {
      location: {
        hostname: 'maredevendas.com.br',
        origin: 'https://maredevendas.com.br',
        pathname: '/',
        hash: '#/conta/entrar',
      },
    })
    vi.doMock('../js/db.js', () => ({
      requireClient: vi.fn(),
      isSupabaseConfigured: () => true,
      getSupabase: vi.fn(),
    }))
    const { getAuthRedirectUrl } = await import('../js/api.js')
    expect(getAuthRedirectUrl()).toBe('https://maredevendas.com.br/#/auth/callback')
  })

  it('renderCustomerRegister includes Google signup button', async () => {
    vi.doMock('../js/api.js', () => ({ signUpCustomer: vi.fn(), signInWithGoogle: vi.fn() }))
    vi.doMock('../js/state.js', () => ({ setUser: vi.fn(), loadUser: vi.fn() }))
    vi.doMock('../js/router.js', () => ({
      navigate: vi.fn(),
      getHashSection: () => null,
      routeHref: (path) => `#${path}`,
    }))

    vi.doMock('../js/rules-plans-panel.js', () => ({
      renderRulesAndPlansContent: () => '<div class="auth-info-panel"><h2 id="regras">Regras</h2></div>',
    }))

    const formStub = { addEventListener: vi.fn() }
    const googleBtn = { addEventListener: vi.fn(), disabled: false }
    const toggleBtn = { addEventListener: vi.fn(), setAttribute: vi.fn(), textContent: '' }
    const panel = { hidden: true }
    const root = { classList: { toggle: vi.fn() } }
    const main = {
      innerHTML: '',
      querySelector: (sel) => {
        if (sel === '#register-form') return formStub
        if (sel === '#google-auth-btn') return googleBtn
        if (sel === '#toggle-rules-panel') return toggleBtn
        if (sel === '#auth-page-info') return panel
        if (sel === '#auth-page-root') return root
        if (sel === '#auth-error') return { innerHTML: '' }
        return null
      },
    }

    const { renderCustomerRegister } = await import('../js/pages/auth.js')
    await renderCustomerRegister(main)

    expect(main.innerHTML).toContain('Criar conta com Google')
    expect(main.innerHTML).toContain('toggle-rules-panel')
    expect(main.innerHTML).toContain('hidden')
    expect(main.innerHTML).not.toContain('auth-page--with-info')
    expect(googleBtn.addEventListener).toHaveBeenCalled()
  })

  it('renderMerchantRegister includes Google signup button', async () => {
    vi.doMock('../js/api.js', () => ({
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      fetchCategories: vi.fn().mockResolvedValue([]),
      fetchNeighborhoods: vi.fn().mockResolvedValue([]),
      createStore: vi.fn(),
      fetchStoreByOwner: vi.fn(),
      promoteCustomerToMerchant: vi.fn(),
    }))
    vi.doMock('../js/state.js', () => ({
      getUser: () => null,
      loadUser: vi.fn(),
      setUser: vi.fn(),
    }))
    vi.doMock('../js/router.js', () => ({
      navigate: vi.fn(),
      getHashSection: () => null,
      routeHref: (path) => `#${path}`,
    }))

    const formStub = { addEventListener: vi.fn() }
    const googleBtn = { addEventListener: vi.fn(), disabled: false }
    const main = {
      innerHTML: '',
      querySelector: (sel) => {
        if (sel === '#merchant-signup') return formStub
        if (sel === '#google-auth-btn') return googleBtn
        if (sel === '#auth-error') return { innerHTML: '' }
        return null
      },
    }

    const { renderMerchantRegister } = await import('../js/pages/auth.js')
    await renderMerchantRegister(main)

    expect(main.innerHTML).toContain('Cadastrar loja com Google')
    expect(main.innerHTML).toContain('ou preencha o formulário')
    expect(googleBtn.addEventListener).toHaveBeenCalled()
  })
})