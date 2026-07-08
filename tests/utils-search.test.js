import { describe, it, expect } from 'vitest'
import { normalizeForSearch } from '../js/utils.js'

describe('normalizeForSearch', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeForSearch('  Padária São João  ')).toBe('padaria sao joao')
  })

  it('collapses whitespace', () => {
    expect(normalizeForSearch('Nova\nHolanda')).toBe('nova holanda')
  })
})