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

/** Produção canônica no domínio próprio (Registro.br → GitHub Pages). */
export const PRODUCTION_SITE_ORIGIN = 'https://maredevendas.com.br'
export const PRODUCTION_SITE_PATH = '/'

/** Fallback / espelho no GitHub Pages (project site). */
export const GITHUB_PAGES_ORIGIN = 'https://kelfys.github.io'
export const GITHUB_PAGES_PATH = '/MaredeVendas-vanilla/'
export const GITHUB_PROJECT_BASE = '/MaredeVendas-vanilla'

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
 * Vazio em maredevendas.com.br, localhost e /; preenchido só em github.io/MaredeVendas-vanilla/.
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
export const ASSET_CACHE_BUST = '20260713b'

/**
 * Marca colorida (assets/icone_perfil.jpg).
 * O favicon.svg atual é silhueta preta (export) e escurece no header.
 */
export function brandIconHref() {
  return `${assetHref('icone_perfil.jpg')}?v=${ASSET_CACHE_BUST}`
}

/** Favicon / logo do site — mesma arte colorida da marca. */
export function faviconHref() {
  return brandIconHref()
}

/** Ícone de perfil do header / conta do cliente. */
export function profileIconHref() {
  return brandIconHref()
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