import { describe, it, expect } from 'vitest'
import { normalizeForSearch, normalizePhoneDigits } from '../js/utils.js'

describe('normalizeForSearch', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeForSearch('  Padária São João  ')).toBe('padaria sao joao')
  })

  it('collapses whitespace', () => {
    expect(normalizeForSearch('Nova\nHolanda')).toBe('nova holanda')
  })

  it('normalizePhoneDigits keeps only numbers', () => {
    expect(normalizePhoneDigits('(21) 97528-6720')).toBe('21975286720')
  })
})