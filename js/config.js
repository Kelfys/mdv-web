/**
 * Configuração central da aplicação.
 *
 * ATENÇÃO: SUPABASE_ANON_KEY é a chave publishable (anon) — pública por design.
 * No dashboard Supabase aparece como NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
 * Nunca commitar secret/service_role key neste arquivo.
 *
 * Manutenção:
 * - Novas cores de tema: adicionar em STORE_THEME_COLORS
 * - Chaves de localStorage: alterar aqui para migrar dados antigos
 *
 * Melhorias futuras:
 * - Carregar credenciais de variáveis de ambiente no build (CI)
 * - Suporte a múltiplos ambientes (dev/staging/prod)
 */
export const SUPABASE_URL = 'https://ulpjsxmilumqedkkfuqw.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_2hCOD3j1j7FRjLMsPF3sdw_4dG7A_HW'

export const APP_NAME = 'MaredeVendas'

/**
 * Conta seed que pode ter N lojas (ads/demo).
 * Admin pode criar mais lojas para este e-mail; demais lojistas = 1 loja.
 * Apagar o usuário remove as lojas (ON DELETE CASCADE).
 */
export const SEED_MULTI_STORE_OWNER_EMAIL = 'lojasfake@gmail.com'

export function isSeedMultiStoreOwnerEmail(email) {
  return String(email ?? '').trim().toLowerCase() === SEED_MULTI_STORE_OWNER_EMAIL
}

/**
 * Conta seed de produtos demo — só para encher o feed de itens (sem loja fake visível).
 *
 * - Produtos no banco precisam de store_id → 1 loja-balde (SEED_PRODUCTS_STORE_SLUG)
 * - Essa loja NÃO aparece no marketplace nem em #/loja/… (oculta ao público)
 * - Os produtos dela ENTRAM no feed (cards de produto) e no carrinho
 * - Admin gerencia em #/admin/produtos (sidebar pinada)
 * - Apagar o usuário remove loja + produtos (cascade)
 */
export const SEED_PRODUCTS_OWNER_EMAIL = 'produtosfake@gmail.com'
export const SEED_PRODUCTS_STORE_SLUG = 'seed-produtos-fake'
export const SEED_PRODUCTS_STORE_NAME = 'Vitrine demo (produtos seed)'

export function isSeedProductsOwnerEmail(email) {
  return String(email ?? '').trim().toLowerCase() === SEED_PRODUCTS_OWNER_EMAIL
}

export function isSeedProductsStore(store) {
  if (!store) return false
  if (typeof store === 'string') return store === SEED_PRODUCTS_STORE_SLUG
  if (store.slug === SEED_PRODUCTS_STORE_SLUG) return true
  return isSeedProductsOwnerEmail(store.owner?.email ?? store.owner_email)
}

/** Loja listável no marketplace público (feed de lojas, busca, página /loja/…). */
export function isPublicMarketplaceStore(store) {
  return Boolean(store) && !isSeedProductsStore(store)
}

/** Produção canônica no domínio próprio (Registro.br → GitHub Pages). */
export const PRODUCTION_SITE_ORIGIN = 'https://maredevendas.com.br'
export const PRODUCTION_SITE_PATH = '/'

/** Fallback / espelho no GitHub Pages (project site). */
export const GITHUB_PAGES_ORIGIN = 'https://kelfys.github.io'
export const GITHUB_PAGES_PATH = '/mdv-web/'
export const GITHUB_PROJECT_BASE = '/mdv-web'

export function getProductionSiteUrl() {
  return `${PRODUCTION_SITE_ORIGIN}${PRODUCTION_SITE_PATH}`
}

export function getGitHubPagesSiteUrl() {
  return `${GITHUB_PAGES_ORIGIN}${GITHUB_PAGES_PATH}`
}

export function isCustomDomainHost(hostname = window.location.hostname) {
  return hostname === 'maredevendas.com.br' || hostname === 'www.maredevendas.com.br'
}

/** @deprecated Use isCustomDomainHost — mantido para imports antigos. */
export function isLegacyCustomDomainHost(hostname = window.location.hostname) {
  return isCustomDomainHost(hostname)
}

export function isGitHubPagesHost(hostname = window.location.hostname) {
  return hostname === 'kelfys.github.io'
}

export function isProductionSiteHost(hostname = window.location.hostname) {
  return isGitHubPagesHost(hostname) || isCustomDomainHost(hostname)
}

/**
 * Prefixo de path quando o app não está na raiz do host.
 * Vazio em maredevendas.com.br, localhost e /; preenchido só em github.io/mdv-web/.
 */
export function detectAppBasePath() {
  const path = window.location.pathname || '/'
  if (path === GITHUB_PROJECT_BASE || path.startsWith(`${GITHUB_PROJECT_BASE}/`)) {
    return GITHUB_PROJECT_BASE
  }
  return ''
}

export const APP_BASE_PATH = detectAppBasePath()

/**
 * Editor visual de textos — página estática fora do SPA (admin abre em nova aba).
 * @see js/staff-nav.js (item strings, external: true)
 */
export function stringsEditorHref() {
  return `${APP_BASE_PATH}/strings-editor.html`
}

/**
 * Arquivos estáticos versionados em assets/ (imagens, fontes, etc.).
 * Respeita APP_BASE_PATH no GitHub Pages. Copiado para dist/ no deploy.
 */
export function assetHref(relativePath = '') {
  const normalized = String(relativePath).replace(/^\//, '')
  return `${APP_BASE_PATH}/assets/${normalized}`
}

/** Query de cache-bust para ícones trocados com frequência. */
export const ASSET_CACHE_BUST = '20260713e'

/**
 * Foto de marca completa (assets/icone_perfil.jpg) — avatares / perfil.
 */
export function brandPhotoHref() {
  return `${assetHref('icone_perfil.jpg')}?v=${ASSET_CACHE_BUST}`
}

/**
 * Favicon vetorial (badge M amarelo/azul).
 * Raster original: favicon.jpg / Downloads/favicon.jfif.
 */
export function brandIconHref() {
  return `${APP_BASE_PATH}/favicon.svg?v=${ASSET_CACHE_BUST}`
}

/** Favicon / logo do header. */
export function faviconHref() {
  return brandIconHref()
}

/** Ícone de perfil do header / conta do cliente. */
export function profileIconHref() {
  return brandPhotoHref()
}

/** Hash (#/rota) — único modo confiável no GitHub Pages (rotas diretas dão 404). */
export const USE_HISTORY_ROUTER = false
export const CART_STORAGE_KEY = 'maredevendas-cart'
export const THEME_STORAGE_KEY = 'maredevendas-theme'

export const STORE_THEME_COLORS = [
  { id: 'pixel-red', hex: '#E52521', gradientFrom: '#E52521', gradientTo: '#9B1414' },
  { id: 'pixel-orange', hex: '#FF6D00', gradientFrom: '#FF6D00', gradientTo: '#C43E00' },
  { id: 'pixel-yellow', hex: '#FBD000', gradientFrom: '#FBD000', gradientTo: '#C9A100' },
  { id: 'pixel-green', hex: '#43B047', gradientFrom: '#43B047', gradientTo: '#2E7D32' },
  { id: 'pixel-cyan', hex: '#00B8D4', gradientFrom: '#00B8D4', gradientTo: '#00838F' },
  { id: 'pixel-blue', hex: '#448AFF', gradientFrom: '#448AFF', gradientTo: '#1565C0' },
  { id: 'pixel-purple', hex: '#88298D', gradientFrom: '#88298D', gradientTo: '#5E1A66' },
  { id: 'pixel-pink', hex: '#FF4081', gradientFrom: '#FF4081', gradientTo: '#C2185B' },
]

export const DEFAULT_THEME_COLOR = 'pixel-blue'

export function getStoreThemeColor(id) {
  return STORE_THEME_COLORS.find((c) => c.id === id) ?? STORE_THEME_COLORS.find((c) => c.id === DEFAULT_THEME_COLOR)
}

/**
 * Cor de texto legível sobre o hex do tema da loja.
 * Amarelo/claro (#FBD000) → texto escuro; cores saturadas → branco.
 */
export function storeThemeOnColor(hex) {
  const raw = String(hex || '').replace('#', '').trim()
  if (raw.length !== 6) return '#ffffff'
  const r = parseInt(raw.slice(0, 2), 16) / 255
  const g = parseInt(raw.slice(2, 4), 16) / 255
  const b = parseInt(raw.slice(4, 6), 16) / 255
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return L > 0.55 ? '#1a1a1a' : '#ffffff'
}

/**
 * Inline style para botões/badges na cor do tema da loja.
 * @param {string|{id?: string, hex?: string}|null|undefined} themeOrId
 */
export function storeThemeButtonStyle(themeOrId) {
  const theme = themeOrId && typeof themeOrId === 'object' && themeOrId.hex
    ? themeOrId
    : getStoreThemeColor(themeOrId?.id ?? themeOrId)
  const hex = theme.hex
  const on = storeThemeOnColor(hex)
  return `background:${hex};border-color:${hex};color:${on}`
}