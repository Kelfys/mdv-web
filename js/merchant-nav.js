/**
 * Navegação do painel do lojista.
 * loginPath aponta para o login unificado em /conta/entrar.
 */
import { getCurrentPath, routeHref } from './router.js'
import { t } from './strings.js'

export const MERCHANT_PANEL = {
  id: 'merchant',
  label: t('nav.merchantPanel'),
  basePath: '/dashboard',
  loginPath: '/conta/entrar',
  icon: '📊',
}

export const MERCHANT_MENU = [
  { id: 'overview', label: t('nav.merchantOverview'), icon: '📊', href: '#/dashboard' },
  { id: 'products', label: t('nav.merchantCatalog'), icon: '📦', href: '#/dashboard/produtos' },
  { id: 'orders', label: t('nav.staffOrders'), icon: '🛒', href: '#/dashboard/pedidos' },
  { id: 'ads', label: t('nav.merchantAds'), icon: '📣', href: '#/dashboard/anuncios' },
  { id: 'plans', label: t('nav.merchantPlans'), icon: '💎', href: '#/dashboard/planos' },
  { id: 'settings', label: t('nav.merchantSettings'), icon: '⚙️', href: '#/dashboard/configuracoes' },
  { id: 'account', label: t('nav.staffAccount'), icon: '🔑', href: '#/dashboard/conta' },
]

export function isMerchantPath(path = getCurrentPath()) {
  return path === '/dashboard' || path.startsWith('/dashboard/')
}

export function getMerchantTab(path = getCurrentPath()) {
  if (path === '/dashboard') return 'overview'
  const segment = path.replace('/dashboard/', '').split('/')[0]
  return MERCHANT_MENU.find((item) => item.id === segment)?.id ?? 'overview'
}

export function getMerchantMenuItem(tab) {
  return MERCHANT_MENU.find((item) => item.id === tab) ?? MERCHANT_MENU[0]
}

export function merchantHref(segment = '') {
  return routeHref(segment ? `/dashboard/${segment}` : '/dashboard')
}

export function merchantMenuHref(item) {
  return routeHref(item.href.replace(/^#\//, '/').replace(/^#/, ''))
}