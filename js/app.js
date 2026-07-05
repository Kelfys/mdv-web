/**
 * Ponto de entrada da aplicação MaredeVendas.
 *
 * Responsabilidades:
 * - Registrar todas as rotas (hash-based SPA)
 * - Tratar callback OAuth do Supabase
 * - Inicializar header, carrinho e roteador
 *
 * Manutenção:
 * - Novas páginas: importar o render e chamar registerRoute() em boot()
 * - Rotas com parâmetros usam sintaxe :nome (ex.: /loja/:slug)
 *
 * Melhorias futuras:
 * - Migrar de hash (#/) para History API (pushState) para URLs limpas
 * - Lazy-load de páginas com dynamic import() para reduzir bundle inicial
 * - Service Worker para cache offline de assets estáticos
 */
import { setTheme, loadUser } from './state.js'
import { initHeader, initCart } from './ui.js'
import { registerRoute, initRouter } from './router.js'
import { renderHome } from './pages/home.js'
import { renderStorePage } from './pages/store-page.js'
import {
  renderCustomerLogin, renderCustomerRegister,
  renderMerchantLogin, renderMerchantRegister, renderAdminLogin,
} from './pages/auth.js'
import { renderMerchantDashboard } from './pages/merchant.js'
import { renderAdminDashboard } from './pages/admin.js'
import { renderFavorites } from './pages/favorites.js'
import { renderRules } from './pages/rules.js'
import { getSupabase } from './db.js'

async function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search)
  if (!params.get('code') && !params.get('error')) return

  const hash = window.location.hash
  if (!hash.includes('auth/callback')) return

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
    window.history.replaceState({}, '', clean.pathname + clean.hash)
  } catch (err) {
    console.error('Auth callback error:', err)
  }
}

function boot() {
  setTheme(localStorage.getItem('maredevendas-theme') || 'light')

  registerRoute('/', renderHome)
  registerRoute('/loja/:slug', renderStorePage)
  registerRoute('/conta/entrar', renderCustomerLogin)
  registerRoute('/conta/criar', renderCustomerRegister)
  registerRoute('/lojista/entrar', renderMerchantLogin)
  registerRoute('/lojista/cadastro', renderMerchantRegister)
  registerRoute('/admin/entrar', renderAdminLogin)
  registerRoute('/admin', (main) => renderAdminDashboard(main, 'overview'))
  registerRoute('/admin/lojas', (main) => renderAdminDashboard(main, 'stores'))
  registerRoute('/admin/produtos', (main) => renderAdminDashboard(main, 'products'))
  registerRoute('/admin/aprovacoes', (main) => renderAdminDashboard(main, 'approvals'))
  registerRoute('/admin/conta', (main) => renderAdminDashboard(main, 'account'))
  registerRoute('/dashboard', (main) => renderMerchantDashboard(main, 'overview'))
  registerRoute('/dashboard/produtos', (main) => renderMerchantDashboard(main, 'products'))
  registerRoute('/dashboard/pedidos', (main) => renderMerchantDashboard(main, 'orders'))
  registerRoute('/dashboard/configuracoes', (main) => renderMerchantDashboard(main, 'settings'))
  registerRoute('/favoritos', renderFavorites)
  registerRoute('/regras', renderRules)
  registerRoute('/auth/callback', async (main) => {
    main.innerHTML = '<div class="loading"><div class="spinner"></div></div>'
    await handleAuthCallback()
    window.location.hash = '#/'
  })

  initHeader()
  initCart()
  initRouter()
}

handleAuthCallback().then(loadUser).then(boot).catch(boot)