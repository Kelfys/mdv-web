/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  normalizeLogoAccentMode,
  applyLogoAccentMode,
  LOGO_ACCENT_DEFAULT,
  LOGO_ACCENT_MODES,
} from '../js/logo-accent.js'

describe('logo accent modes', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-logo-accent')
  })

  afterEach(() => {
    document.documentElement.removeAttribute('data-logo-accent')
  })

  it('normalizes known modes', () => {
    expect(normalizeLogoAccentMode('promo')).toBe('promo')
    expect(normalizeLogoAccentMode('URGENTE')).toBe('urgente')
    expect(normalizeLogoAccentMode('  alerta ')).toBe('alerta')
  })

  it('falls back to normal for unknown values', () => {
    expect(normalizeLogoAccentMode('xyz')).toBe(LOGO_ACCENT_DEFAULT)
    expect(normalizeLogoAccentMode('')).toBe(LOGO_ACCENT_DEFAULT)
    expect(normalizeLogoAccentMode(null)).toBe(LOGO_ACCENT_DEFAULT)
  })

  it('applies data-logo-accent on documentElement', () => {
    applyLogoAccentMode('urgente')
    expect(document.documentElement.dataset.logoAccent).toBe('urgente')
    applyLogoAccentMode('invalid')
    expect(document.documentElement.dataset.logoAccent).toBe('normal')
  })

  it('exposes five modes for the admin selector', () => {
    expect(LOGO_ACCENT_MODES.map((m) => m.id)).toEqual([
      'normal', 'promo', 'alerta', 'urgente', 'info',
    ])
  })
})
