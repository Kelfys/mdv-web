/**
 * Ponto de entrada da aplicação MaredeVendas.
 *
 * Inicializa tema, header, carrinho e roteador. Páginas carregadas sob demanda
 * via import() dinâmico (lazy). Rotas públicas, painéis e auth em registerRoute.
 */
import { setTheme, loadUser, onAuthChange } from './state.js'
import { initHeader, initCart } from './ui.js'
import { registerRoute, initRouter, routeHref, navigate, getCurrentPath, render } from './router.js'
import { getSupabase } from './db.js'
import { completeOAuthSignup, fetchLogoAccentMode } from './api.js'
import { applyLogoAccentMode } from './logo-accent.js'
import { initScrollToTop } from './scroll-to-top.js'
import { initHeaderScroll } from './header-scroll.js'

const PROTECTED_ROUTE_PREFIXES = ['/dashboard', '/admin', '/moderador']

function isProtectedRoute(path) {
  return PROTECTED_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

/** Aguarda a sessão do Supabase ser restaurada do storage antes do primeiro loadUser. */
async function waitForInitialSession() {
  const client = getSupabase()
  if (!client) return

  await new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }

    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION') {
        subscription.unsubscribe()
        finish()
      }
    })

    client.auth.getSession().finally(() => {
      setTimeout(() => {
        subscription.unsubscribe()
        finish()
      }, 100)
    })

    setTimeout(() => {
      subscription.unsubscribe()
      finish()
    }, 8000)
  })
}

const lazy = (loader) => async (main, params) => {
  const mod = await loader()
  const fn = mod.default ?? Object.values(mod).find((v) => typeof v === 'function')
  return fn(main, params)
}

let postAuthRedirect = null

/** Troca ?code= da URL por sessão Supabase (OAuth Google e recovery). Funciona com hash #/auth/callback. */
async function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const oauthError = params.get('error')
  if (!code && !oauthError) return null

  try {
    const client = getSupabase()
    if (oauthError) {
      throw new Error(params.get('error_description') || oauthError)
    }
    if (client && code) {
      await client.auth.exchangeCodeForSession(code)
      try {
        await completeOAuthSignup()
      } catch (err) {
        console.error('OAuth signup completion error:', err)
      }
      try {
        postAuthRedirect = sessionStorage.getItem('oauth-next') || '/favoritos'
        sessionStorage.removeItem('oauth-next')
      } catch {
        postAuthRedirect = '/favoritos'
      }
    }
    const clean = new URL(window.location.href)
    clean.searchParams.delete('code')
    clean.searchParams.delete('state')
    clean.searchParams.delete('error')
    clean.searchParams.delete('error_description')
    if (!clean.hash || clean.hash === '#') {
      clean.hash = '#/auth/callback'
    }
    window.history.replaceState({}, '', clean.pathname + clean.search + clean.hash)
    return postAuthRedirect
  } catch (err) {
    console.error('Auth callback error:', err)
    return null
  }
}

/** Converte /repo/rota → /repo/#/rota sem recarregar (evita tela branca no F5). */
function normalizePathnameToHash() {
  const currentHash = window.location.hash.replace(/^#/, '')
  if (currentHash && currentHash !== '/') return

  try {
    const stored = sessionStorage.getItem('spa-redirect')
    if (stored) {
      sessionStorage.removeItem('spa-redirect')
      const parts = stored.match(/^(\/[^/]+)(\/.*)?$/)
      const sub = parts?.[2]?.replace(/\/$/, '') || ''
      if (sub && sub !== '/') {
        history.replaceState(null, '', `${parts[1]}/#${sub}${window.location.search}`)
        return
      }
    }
  } catch {
    // sessionStorage indisponível
  }

  const m = window.location.pathname.match(/^(\/[^/]+)(\/.*)?$/)
  const subpath = m?.[2]?.replace(/\/$/, '') || ''
  if (!subpath || subpath === '/') return

  history.replaceState(null, '', `${m[1]}/#${subpath}${window.location.search}`)
}

/** Mantém state.js sincronizado com Supabase e re-renderiza rotas protegidas ao trocar sessão. */
function setupAuthListeners() {
  const client = getSupabase()
  if (!client) return

  client.auth.onAuthStateChange(async (event) => {
    if (!['SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) return
    await loadUser()
  })

  onAuthChange(() => {
    const path = getCurrentPath()
    if (isProtectedRoute(path)) render()
  })
}

function boot() {
  normalizePathnameToHash()
  setTheme(localStorage.getItem('maredevendas-theme') || 'light')

  registerRoute('/admin/entrar', lazy(() => import('./pages/auth.js').then((m) => ({ default: m.renderAdminLogin }))))
  registerRoute('/moderador/entrar', lazy(() => import('./pages/auth.js').then((m) => ({ default: m.renderModeratorLogin }))))
  registerRoute('/conta/entrar', lazy(() => import('./pages/auth.js').then((m) => ({ default: m.renderLogin }))))
  registerRoute('/conta/criar', lazy(() => import('./pages/auth.js').then((m) => ({ default: m.renderCustomerRegister }))))
  registerRoute('/lojista/entrar', lazy(() => import('./pages/auth.js').then((m) => ({ default: m.renderLogin }))))
  registerRoute('/lojista/cadastro', lazy(() => import('./pages/auth.js').then((m) => ({ default: m.renderMerchantRegister }))))
  registerRoute('/', lazy(() => import('./pages/home.js').then((m) => ({ default: m.renderHome }))))
  registerRoute('/loja/:slug', lazy(() => import('./pages/store-page.js').then((m) => ({ default: m.renderStorePage }))))
  registerRoute('/admin', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderAdminDashboard(main, 'overview') }))))
  registerRoute('/admin/lojas', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderAdminDashboard(main, 'stores') }))))
  registerRoute('/admin/produtos/:storeId', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main, p) => m.renderAdminDashboard(main, 'products', p.storeId) }))))
  registerRoute('/admin/produtos', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderAdminDashboard(main, 'products') }))))
  registerRoute('/admin/anuncios', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderAdminDashboard(main, 'ads') }))))
  registerRoute('/admin/pedidos', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderAdminDashboard(main, 'pedidos') }))))
  registerRoute('/admin/aprovacoes', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderAdminDashboard(main, 'approvals') }))))
  registerRoute('/admin/denuncias', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderAdminDashboard(main, 'reports') }))))
  registerRoute('/admin/bairros', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderAdminDashboard(main, 'neighborhoods') }))))
  registerRoute('/admin/categorias', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderAdminDashboard(main, 'categories') }))))
  registerRoute('/admin/moderadores', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderAdminDashboard(main, 'moderators') }))))
  registerRoute('/admin/perfis', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderAdminDashboard(main, 'profiles') }))))
  registerRoute('/admin/conta', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderAdminDashboard(main, 'account') }))))
  registerRoute('/moderador', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderModeratorDashboard(main, 'overview') }))))
  registerRoute('/moderador/aprovacoes', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderModeratorDashboard(main, 'approvals') }))))
  registerRoute('/moderador/denuncias', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderModeratorDashboard(main, 'reports') }))))
  registerRoute('/moderador/lojas', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderModeratorDashboard(main, 'stores') }))))
  registerRoute('/moderador/produtos/:storeId', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main, p) => m.renderModeratorDashboard(main, 'products', p.storeId) }))))
  registerRoute('/moderador/produtos', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderModeratorDashboard(main, 'products') }))))
  registerRoute('/moderador/pedidos', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderModeratorDashboard(main, 'pedidos') }))))
  registerRoute('/moderador/anuncios', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderModeratorDashboard(main, 'ads') }))))
  registerRoute('/moderador/conta', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderModeratorDashboard(main, 'account') }))))
  registerRoute('/dashboard', lazy(() => import('./pages/merchant.js').then((m) => ({ default: (main) => m.renderMerchantDashboard(main, 'overview') }))))
  registerRoute('/dashboard/produtos', lazy(() => import('./pages/merchant.js').then((m) => ({ default: (main) => m.renderMerchantDashboard(main, 'products') }))))
  registerRoute('/dashboard/pedidos', lazy(() => import('./pages/merchant.js').then((m) => ({ default: (main) => m.renderMerchantDashboard(main, 'orders') }))))
  registerRoute('/dashboard/anuncios', lazy(() => import('./pages/merchant.js').then((m) => ({ default: (main) => m.renderMerchantDashboard(main, 'ads') }))))
  registerRoute('/dashboard/planos', lazy(() => import('./pages/merchant.js').then((m) => ({ default: (main) => m.renderMerchantDashboard(main, 'plans') }))))
  registerRoute('/dashboard/configuracoes', lazy(() => import('./pages/merchant.js').then((m) => ({ default: (main) => m.renderMerchantDashboard(main, 'settings') }))))
  registerRoute('/dashboard/conta', lazy(() => import('./pages/merchant.js').then((m) => ({ default: (main) => m.renderMerchantDashboard(main, 'account') }))))
  registerRoute('/favoritos', lazy(() => import('./pages/favorites.js').then((m) => ({ default: m.renderFavorites }))))
  registerRoute('/regras', lazy(() => import('./pages/rules.js').then((m) => ({ default: m.renderRules }))))
  registerRoute('/auth/callback', async (main) => {
    main.innerHTML = '<div class="loading"><div class="spinner"></div></div>'
    const next = postAuthRedirect || '/favoritos'
    navigate(next.startsWith('/') ? next : '/favoritos')
  })

  initHeader()
  initCart()
  initScrollToTop() // botão ↑ — ver js/scroll-to-top.js
  initHeaderScroll() // auto-hide do header no mobile — ver js/header-scroll.js
  setupAuthListeners()
  initRouter()
  delete window.__MV_INITIAL_ROUTE__
}

/** Cor do “Vendas” no logo — pública (platform_settings), todos os visitantes. */
async function loadLogoAccent() {
  try {
    const mode = await fetchLogoAccentMode()
    applyLogoAccentMode(mode)
  } catch (err) {
    console.warn('Logo accent:', err)
    applyLogoAccentMode('normal')
  }
}

// Ordem: OAuth → sessão restaurada → perfil carregado → rotas (evita "Acesso restrito" no F5)
handleAuthCallback()
  .then(() => waitForInitialSession())
  .then(() => loadUser())
  .then(() => loadLogoAccent())
  .then(boot)
  .catch((err) => {
    console.error('Boot error:', err)
    boot()
  })