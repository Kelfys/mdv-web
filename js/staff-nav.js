/**
 * Navegação dos painéis admin e moderador.
 */
import { getCurrentPath } from './router.js'

export const STAFF_PANELS = {
  admin: {
    id: 'admin',
    label: 'Painel Admin',
    basePath: '/admin',
    loginPath: '/admin/entrar',
    icon: '⚙️',
  },
  moderator: {
    id: 'moderator',
    label: 'Painel Moderador',
    basePath: '/moderador',
    loginPath: '/moderador/entrar',
    icon: '🛡️',
  },
}

export const ADMIN_MENU = [
  { id: 'overview', label: 'Visão Geral', icon: '📊', href: '#/admin' },
  { id: 'stores', label: 'Lojas', icon: '🏪', href: '#/admin/lojas' },
  { id: 'products', label: 'Produtos', icon: '📦', href: '#/admin/produtos' },
  { id: 'pedidos', label: 'Pedidos', icon: '🛒', href: '#/admin/pedidos' },
  { id: 'approvals', label: 'Aprovações', icon: '✅', href: '#/admin/aprovacoes' },
  { id: 'moderators', label: 'Moderadores', icon: '🛡️', href: '#/admin/moderadores' },
  { id: 'account', label: 'Minha Conta', icon: '🔑', href: '#/admin/conta' },
]

export const MODERATOR_MENU = [
  { id: 'overview', label: 'Visão Geral', icon: '📊', href: '#/moderador' },
  { id: 'approvals', label: 'Aprovações', icon: '✅', href: '#/moderador/aprovacoes' },
  { id: 'stores', label: 'Lojas', icon: '🏪', href: '#/moderador/lojas', readOnly: true },
  { id: 'products', label: 'Produtos', icon: '📦', href: '#/moderador/produtos', readOnly: true },
  { id: 'pedidos', label: 'Pedidos', icon: '🛒', href: '#/moderador/pedidos' },
  { id: 'account', label: 'Minha Conta', icon: '🔑', href: '#/moderador/conta' },
]

export function staffHref(panel, segment = '') {
  const base = STAFF_PANELS[panel]?.basePath ?? '/admin'
  return segment ? `#${base}/${segment}` : `#${base}`
}

export function getStaffMenu(panel = 'admin') {
  return panel === 'moderator' ? MODERATOR_MENU : ADMIN_MENU
}

export function isStaffPath(path = getCurrentPath()) {
  return path === '/admin' || path.startsWith('/admin/')
    || path === '/moderador' || path.startsWith('/moderador/')
}

export function getStaffPanel(path = getCurrentPath()) {
  if (path === '/moderador' || path.startsWith('/moderador/')) return 'moderator'
  if (path === '/admin' || path.startsWith('/admin/')) return 'admin'
  return null
}

export function getStaffTab(path = getCurrentPath(), panel = getStaffPanel(path)) {
  if (!panel) return null
  const base = STAFF_PANELS[panel].basePath
  if (path === base) return 'overview'
  const segment = path.replace(`${base}/`, '').split('/')[0]
  const menu = getStaffMenu(panel)
  return menu.find((item) => item.id === segment)?.id ?? 'overview'
}

export function getStaffMenuItem(tab, panel = 'admin') {
  return getStaffMenu(panel).find((item) => item.id === tab) ?? getStaffMenu(panel)[0]
}

// Compatibilidade com imports antigos
export const ADMIN_MENU_LEGACY = ADMIN_MENU
export function isAdminPath(path = getCurrentPath()) {
  return path === '/admin' || path.startsWith('/admin/')
}

export function getAdminTab(path = getCurrentPath()) {
  return getStaffTab(path, 'admin')
}

export function getAdminMenuItem(tab) {
  return getStaffMenuItem(tab, 'admin')
}