/**
 * Navegação do painel admin — menu do ícone ⚙️ e barra de ferramentas.
 */
export const ADMIN_MENU = [
  { id: 'overview', label: 'Visão Geral', icon: '📊', href: '#/admin' },
  { id: 'stores', label: 'Lojas', icon: '🏪', href: '#/admin/lojas', action: 'store' },
  { id: 'products', label: 'Produtos', icon: '📦', href: '#/admin/produtos', action: 'product' },
  { id: 'pedidos', label: 'Pedidos', icon: '🛒', href: '#/admin/pedidos' },
  { id: 'approvals', label: 'Aprovações', icon: '✅', href: '#/admin/aprovacoes' },
  { id: 'account', label: 'Minha Conta', icon: '🔑', href: '#/admin/conta' },
]

function currentPath() {
  return window.location.hash.replace(/^#/, '') || '/'
}

export function isAdminPath(path = currentPath()) {
  return path === '/admin' || path.startsWith('/admin/')
}

export function getAdminTab(path = currentPath()) {
  if (!isAdminPath(path)) return null
  if (path === '/admin') return 'overview'
  const segment = path.replace('/admin/', '').split('/')[0]
  const found = ADMIN_MENU.find((item) => item.id === segment)
  return found?.id ?? 'overview'
}

export function getAdminMenuItem(tab) {
  return ADMIN_MENU.find((item) => item.id === tab) ?? ADMIN_MENU[0]
}