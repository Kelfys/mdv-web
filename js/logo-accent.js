/**
 * Cor de alerta do “Vendas” no logo do cabeçalho.
 * Presets em CSS: html[data-logo-accent="…"] .logo span.accent
 * Valor público em platform_settings.logo_accent (todos os visitantes).
 */
import { t } from './strings.js'

export const LOGO_ACCENT_KEY = 'logo_accent'
export const LOGO_ACCENT_DEFAULT = 'normal'

/** Presets disponíveis no seletor do admin. */
export const LOGO_ACCENT_MODES = [
  { id: 'normal', labelKey: 'admin.logoAccentNormal', hintKey: 'admin.logoAccentNormalHint' },
  { id: 'promo', labelKey: 'admin.logoAccentPromo', hintKey: 'admin.logoAccentPromoHint' },
  { id: 'alerta', labelKey: 'admin.logoAccentAlert', hintKey: 'admin.logoAccentAlertHint' },
  { id: 'urgente', labelKey: 'admin.logoAccentUrgent', hintKey: 'admin.logoAccentUrgentHint' },
  { id: 'info', labelKey: 'admin.logoAccentInfo', hintKey: 'admin.logoAccentInfoHint' },
]

const MODE_IDS = new Set(LOGO_ACCENT_MODES.map((m) => m.id))

export function normalizeLogoAccentMode(value) {
  const id = String(value ?? '').trim().toLowerCase()
  return MODE_IDS.has(id) ? id : LOGO_ACCENT_DEFAULT
}

/** Aplica o modo no <html> (todos veem na próxima render do CSS). */
export function applyLogoAccentMode(mode) {
  const id = normalizeLogoAccentMode(mode)
  if (typeof document === 'undefined') return id
  document.documentElement.dataset.logoAccent = id
  return id
}

export function getAppliedLogoAccentMode() {
  if (typeof document === 'undefined') return LOGO_ACCENT_DEFAULT
  return normalizeLogoAccentMode(document.documentElement.dataset.logoAccent)
}

export function logoAccentModeLabel(mode) {
  const id = normalizeLogoAccentMode(mode)
  const def = LOGO_ACCENT_MODES.find((m) => m.id === id)
  return def ? t(def.labelKey) : t('admin.logoAccentNormal')
}

export function logoAccentOptionsHtml(selected = LOGO_ACCENT_DEFAULT) {
  const current = normalizeLogoAccentMode(selected)
  return LOGO_ACCENT_MODES.map((m) => `
    <option value="${m.id}" ${m.id === current ? 'selected' : ''}>
      ${escapePlain(t(m.labelKey))}
    </option>
  `).join('')
}

function escapePlain(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
