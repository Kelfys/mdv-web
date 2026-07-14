import { describe, it, expect } from 'vitest'
import {
  STRINGS,
  t,
  flattenStrings,
  unflattenStrings,
  serializeStringsModule,
} from '../js/strings.js'

describe('strings', () => {
  it('t resolves dotted keys', () => {
    expect(t('nav.home')).toBe('Início')
    expect(t('app.name')).toBe('MaredeVendas')
    expect(t('engagement.storeFavorites')).toBe('favoritos')
    expect(t('store.engagementTitle')).toBe('Popularidade')
  })

  it('t returns key when missing', () => {
    expect(t('missing.key')).toBe('missing.key')
  })

  it('t replaces placeholders', () => {
    expect(t('cart.itemsCount', { count: 3 })).toBe('Itens (3)')
    expect(t('cart.itemsCount', {})).toBe('Itens ({count})')
  })

  it('flattenStrings produces stable paths', () => {
    const rows = flattenStrings(STRINGS)
    expect(rows.some((r) => r.key === 'home.tabFeed' && r.value === 'Para você')).toBe(true)
    expect(rows.length).toBeGreaterThan(100)
  })

  it('unflattenStrings round-trips flatten', () => {
    const rows = flattenStrings(STRINGS)
    const rebuilt = unflattenStrings(rows)
    expect(rebuilt).toEqual(STRINGS)
  })

  it('serializeStringsModule includes export and helpers used by the app', () => {
    const out = serializeStringsModule(STRINGS)
    expect(out).toContain('export const STRINGS =')
    expect(out).toContain('export function t(')
    expect(out).toContain('export function deliveryPeriodLabel(')
    expect(out).toContain('export function orderStatusLabel(')
    expect(out).toContain('export function flattenStrings(')
    expect(out).toContain('export function unflattenStrings(')
    expect(out).toContain('export function serializeStringsModule(')
    expect(out).toContain('"home": "Início"')
    expect(out).toContain('featureFreeItems1')
  })
})