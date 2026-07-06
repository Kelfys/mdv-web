/**
 * Ponto de entrada da aplicação MaredeVendas.
 *
 * Inicializa tema, header, carrinho e roteador. Páginas carregadas sob demanda
 * via import() dinâmico (lazy). Rotas públicas, painéis e auth em registerRoute.
 */
import { setTheme, loadUser } from './state.js'
import { initHeader, initCart } from './ui.js'
import { registerRoute, initRouter, routeHref } from './router.js'
import { getSupabase } from './db.js'

const lazy = (loader) => async (main, params) => {
  const mod = await loader()
  const fn = mod.default ?? Object.values(mod).find((v) => typeof v === 'function')
  return fn(main, params)
}

async function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search)
  if (!params.get('code') && !params.get('error')) return

  const path = window.location.pathname + window.location.hash
  if (!path.includes('auth/callback')) return

  try {
    const client = getSupabase()
    if (client) {
      const code = params.get('code')
      if (code) await client.auth.exchangeCodeForSession(code)
      await loadUser()
    }
    const clean = new URL(window.location.href)
    clean.searchParams.delete('code')
    clean.searchParams.delete('state')
    window.history.replaceState({}, '', clean.pathname + clean.search)
  } catch (err) {
    console.error('Auth callback error:', err)
  }
}

function boot() {
  setTheme(localStorage.getItem('maredevendas-theme') || 'light')

  registerRoute('/', lazy(() => import('./pages/home.js').then((m) => ({ default: m.renderHome }))))
  registerRoute('/loja/:slug', lazy(() => import('./pages/store-page.js').then((m) => ({ default: m.renderStorePage }))))
  registerRoute('/conta/entrar', lazy(() => import('./pages/auth.js').then((m) => ({ default: m.renderLogin }))))
  registerRoute('/conta/criar', lazy(() => import('./pages/auth.js').then((m) => ({ default: m.renderCustomerRegister }))))
  registerRoute('/lojista/entrar', lazy(() => import('./pages/auth.js').then((m) => ({ default: m.renderLogin }))))
  registerRoute('/lojista/cadastro', lazy(() => import('./pages/auth.js').then((m) => ({ default: m.renderMerchantRegister }))))
  registerRoute('/admin/entrar', lazy(() => import('./pages/auth.js').then((m) => ({ default: m.renderAdminLogin }))))
  registerRoute('/admin', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderAdminDashboard(main, 'overview') }))))
  registerRoute('/admin/lojas', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderAdminDashboard(main, 'stores') }))))
  registerRoute('/admin/produtos/:storeId', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main, p) => m.renderAdminDashboard(main, 'products', p.storeId) }))))
  registerRoute('/admin/produtos', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderAdminDashboard(main, 'products') }))))
  registerRoute('/admin/pedidos', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderAdminDashboard(main, 'pedidos') }))))
  registerRoute('/admin/aprovacoes', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderAdminDashboard(main, 'approvals') }))))
  registerRoute('/admin/moderadores', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderAdminDashboard(main, 'moderators') }))))
  registerRoute('/admin/conta', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderAdminDashboard(main, 'account') }))))
  registerRoute('/moderador/entrar', lazy(() => import('./pages/auth.js').then((m) => ({ default: m.renderModeratorLogin }))))
  registerRoute('/moderador', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderModeratorDashboard(main, 'overview') }))))
  registerRoute('/moderador/aprovacoes', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderModeratorDashboard(main, 'approvals') }))))
  registerRoute('/moderador/lojas', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderModeratorDashboard(main, 'stores') }))))
  registerRoute('/moderador/produtos/:storeId', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main, p) => m.renderModeratorDashboard(main, 'products', p.storeId) }))))
  registerRoute('/moderador/produtos', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderModeratorDashboard(main, 'products') }))))
  registerRoute('/moderador/pedidos', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderModeratorDashboard(main, 'pedidos') }))))
  registerRoute('/moderador/conta', lazy(() => import('./pages/admin.js').then((m) => ({ default: (main) => m.renderModeratorDashboard(main, 'account') }))))
  registerRoute('/dashboard', lazy(() => import('./pages/merchant.js').then((m) => ({ default: (main) => m.renderMerchantDashboard(main, 'overview') }))))
  registerRoute('/dashboard/produtos', lazy(() => import('./pages/merchant.js').then((m) => ({ default: (main) => m.renderMerchantDashboard(main, 'products') }))))
  registerRoute('/dashboard/pedidos', lazy(() => import('./pages/merchant.js').then((m) => ({ default: (main) => m.renderMerchantDashboard(main, 'orders') }))))
  registerRoute('/dashboard/anuncios', lazy(() => import('./pages/merchant.js').then((m) => ({ default: (main) => m.renderMerchantDashboard(main, 'ads') }))))
  registerRoute('/dashboard/configuracoes', lazy(() => import('./pages/merchant.js').then((m) => ({ default: (main) => m.renderMerchantDashboard(main, 'settings') }))))
  registerRoute('/dashboard/conta', lazy(() => import('./pages/merchant.js').then((m) => ({ default: (main) => m.renderMerchantDashboard(main, 'account') }))))
  registerRoute('/favoritos', lazy(() => import('./pages/favorites.js').then((m) => ({ default: m.renderFavorites }))))
  registerRoute('/regras', lazy(() => import('./pages/rules.js').then((m) => ({ default: m.renderRules }))))
  registerRoute('/auth/callback', async (main) => {
    main.innerHTML = '<div class="loading"><div class="spinner"></div></div>'
    await handleAuthCallback()
    window.location.href = routeHref('/')
  })

  initHeader()
  initCart()
  initRouter()
}

handleAuthCallback().then(loadUser).then(boot).catch(boot)