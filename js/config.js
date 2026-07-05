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

/** Base path no GitHub Pages (vazio em localhost na raiz). */
export function detectAppBasePath() {
  const match = window.location.pathname.match(/^(\/[^/]+)/)
  if (match && !match[1].includes('.')) return match[1]
  return ''
}

export const APP_BASE_PATH = detectAppBasePath()

/** true = URLs limpas (/dashboard); false = hash (#/dashboard) */
export const USE_HISTORY_ROUTER = Boolean(APP_BASE_PATH)
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