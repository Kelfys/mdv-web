/**
 * Navegação do painel do lojista.
 */
export const MERCHANT_PANEL = {
  id: 'merchant',
  label: 'Painel do Lojista',
  basePath: '/dashboard',
  loginPath: '/lojista/entrar',
  icon: '📊',
}

export const MERCHANT_MENU = [
  { id: 'overview', label: 'Visão Geral', icon: '📊', href: '#/dashboard' },
  { id: 'products', label: 'Produtos', icon: '📦', href: '#/dashboard/produtos' },
  { id: 'orders', label: 'Pedidos', icon: '🛒', href: '#/dashboard/pedidos' },
  { id: 'settings', label: 'Configurações', icon: '⚙️', href: '#/dashboard/configuracoes' },
]

function currentPath() {
  return window.location.hash.replace(/^#/, '') || '/'
}

export function isMerchantPath(path = currentPath()) {
  return path === '/dashboard' || path.startsWith('/dashboard/')
}

export function getMerchantTab(path = currentPath()) {
  if (path === '/dashboard') return 'overview'
  const segment = path.replace('/dashboard/', '').split('/')[0]
  return MERCHANT_MENU.find((item) => item.id === segment)?.id ?? 'overview'
}

export function getMerchantMenuItem(tab) {
  return MERCHANT_MENU.find((item) => item.id === tab) ?? MERCHANT_MENU[0]
}

export function merchantHref(segment = '') {
  return segment ? `#/dashboard/${segment}` : '#/dashboard'
}