import { describe, it, expect } from 'vitest'
import {
  normalizeInstagramHandle,
  validateInstagramHandle,
  instagramProfileUrl,
  formatInstagramDisplay,
} from '../js/utils.js'

describe('instagram helpers', () => {
  it('normalizes handle from @user, URL or plain username', () => {
    expect(normalizeInstagramHandle('@MinhaLoja')).toBe('MinhaLoja')
    expect(normalizeInstagramHandle('https://www.instagram.com/minha.loja/')).toBe('minha.loja')
    expect(normalizeInstagramHandle('minha_loja')).toBe('minha_loja')
  })

  it('validates instagram handle', () => {
    expect(validateInstagramHandle('')).toEqual({ ok: true, handle: '' })
    expect(validateInstagramHandle('@loja_ok')).toEqual({ ok: true, handle: 'loja_ok' })
    expect(validateInstagramHandle('bad handle!').ok).toBe(false)
  })

  it('builds profile url and display label', () => {
    expect(instagramProfileUrl('minhaloja')).toBe('https://www.instagram.com/minhaloja/')
    expect(formatInstagramDisplay('minhaloja')).toBe('@minhaloja')
  })
})