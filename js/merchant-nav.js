/**
 * Navegação do painel do lojista.
 * loginPath aponta para o login unificado em /conta/entrar.
 */
import { getCurrentPath, routeHref } from './router.js'

export const MERCHANT_PANEL = {
  id: 'merchant',
  label: 'Painel do Lojista',
  basePath: '/dashboard',
  loginPath: '/conta/entrar',
  icon: '📊',
}

export const MERCHANT_MENU = [
  { id: 'overview', label: 'Visão Geral', icon: '📊', href: '#/dashboard' },
  { id: 'products', label: 'Produtos', icon: '📦', href: '#/dashboard/produtos' },
  { id: 'orders', label: 'Pedidos', icon: '🛒', href: '#/dashboard/pedidos' },
  { id: 'ads', label: 'Anúncios', icon: '📣', href: '#/dashboard/anuncios' },
  { id: 'settings', label: 'Configurações', icon: '⚙️', href: '#/dashboard/configuracoes' },
  { id: 'account', label: 'Minha Conta', icon: '🔑', href: '#/dashboard/conta' },
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