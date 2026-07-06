import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderRulesAndPlansContent } from '../js/rules-plans-panel.js'

describe('login page rules and plans', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: { hash: '#/conta/entrar' },
      scrollTo: vi.fn(),
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

  it('renderLogin includes rules and plans panel', async () => {
    vi.doMock('../js/api.js', () => ({ signIn: vi.fn() }))
    vi.doMock('../js/state.js', () => ({ setUser: vi.fn() }))
    vi.doMock('../js/router.js', () => ({
      navigate: vi.fn(),
      getHashSection: () => null,
      routeHref: (path) => `#${path}`,
    }))
    vi.doMock('../js/rules-plans-panel.js', () => ({
      renderRulesAndPlansContent: () => `
        <div class="auth-info-panel">
          <h2 id="regras">Regras</h2>
          <section id="planos">Planos para lojistas</section>
          <p>Conduta</p>
        </div>`,
    }))

    const formStub = { addEventListener: vi.fn() }
    const googleBtn = { addEventListener: vi.fn(), disabled: false }
    const main = {
      innerHTML: '',
      querySelector: (sel) => {
        if (sel === '#login-form') return formStub
        if (sel === '#google-auth-btn') return googleBtn
        if (sel === '#auth-error') return { innerHTML: '' }
        return null
      },
    }
    const { renderLogin } = await import('../js/pages/auth.js')
    await renderLogin(main)

    expect(main.innerHTML).toContain('Esqueci minha senha')
    expect(main.innerHTML).toContain('Entrar com Google')
    expect(main.innerHTML).toContain('btn-google')
    expect(main.innerHTML).toContain('ou use email e senha')
    expect(googleBtn.addEventListener).toHaveBeenCalled()
    expect(main.innerHTML).toContain('auth-page--with-info')
    expect(main.innerHTML).toContain('auth-page__info')
    expect(main.innerHTML).toContain('id="regras"')
    expect(main.innerHTML).toContain('id="planos"')
    expect(main.innerHTML).not.toContain('Enviar comprovante')
    expect(main.innerHTML).not.toContain('sec=regras')
    expect(main.innerHTML).not.toContain('sec=planos')
    expect(main.innerHTML).toContain('Acesso admin')
    expect(main.innerHTML).toContain('Conduta')
  })

  it('renderRules redirects to login rules section', async () => {
    const navigate = vi.fn()
    vi.doMock('../js/router.js', () => ({ navigate, getHashSection: () => null }))

    const main = { innerHTML: '' }
    const { renderRules } = await import('../js/pages/rules.js')
    await renderRules(main)

    expect(navigate).toHaveBeenCalledWith('/conta/entrar?sec=regras')
  })

  it('rules panel content is self-contained', () => {
    const html = renderRulesAndPlansContent()
    expect(html).toContain('1. Sobre o MaredeVendas')
    expect(html).toContain('4. Planos para lojistas')
    expect(html).toContain('5. Conduta')
    expect(html).toContain('plan-grid')
  })
})