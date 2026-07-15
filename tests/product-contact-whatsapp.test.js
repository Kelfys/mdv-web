import { describe, it, expect } from 'vitest'
import { getProductContactWhatsapp } from '../js/utils.js'

describe('getProductContactWhatsapp', () => {
  it('prefers product.whatsapp over store.whatsapp', () => {
    expect(getProductContactWhatsapp({
      whatsapp: '21988887777',
      store: { whatsapp: '21911112222' },
    })).toBe('21988887777')
  })

  it('falls back to store.whatsapp', () => {
    expect(getProductContactWhatsapp({
      store: { whatsapp: '21911112222' },
    })).toBe('21911112222')
  })

  it('returns empty when neither is set', () => {
    expect(getProductContactWhatsapp({})).toBe('')
  })
})
