import { describe, it, expect } from 'vitest'
import {
  normalizeBrazilWhatsapp,
  parseBrazilWhatsapp,
  buildWhatsAppUrl,
} from '../js/whatsapp.js'

describe('normalizeBrazilWhatsapp', () => {
  it('adds DDI 55 to DDD+number (11 digits mobile)', () => {
    expect(normalizeBrazilWhatsapp('21912345678')).toBe('5521912345678')
  })

  it('keeps number that already has DDI 55', () => {
    expect(normalizeBrazilWhatsapp('5521912345678')).toBe('5521912345678')
  })

  it('strips formatting and leading zero', () => {
    expect(normalizeBrazilWhatsapp('(21) 91234-5678')).toBe('5521912345678')
    expect(normalizeBrazilWhatsapp('021912345678')).toBe('5521912345678')
  })

  it('does not treat DDD 55 as country code (11-digit national)', () => {
    // DDD 55 (RS) + 9xxxxxxxx → deve virar 5555…
    expect(normalizeBrazilWhatsapp('55987654321')).toBe('5555987654321')
  })

  it('landline 10 digits gets 55', () => {
    expect(normalizeBrazilWhatsapp('2133334444')).toBe('552133334444')
  })
})

describe('parseBrazilWhatsapp', () => {
  it('accepts 21912345678', () => {
    const r = parseBrazilWhatsapp('21912345678')
    expect(r.ok).toBe(true)
    expect(r.digits).toBe('5521912345678')
  })

  it('rejects too short', () => {
    expect(parseBrazilWhatsapp('219123').ok).toBe(false)
  })

  it('rejects empty', () => {
    expect(parseBrazilWhatsapp('').ok).toBe(false)
  })
})

describe('buildWhatsAppUrl', () => {
  it('builds wa.me with DDI for 21912345678', () => {
    const url = buildWhatsAppUrl('21912345678', 'oi')
    expect(url).toBe('https://wa.me/5521912345678?text=oi')
  })

  it('does not double-prefix 55', () => {
    const url = buildWhatsAppUrl('5521912345678', 'ola')
    expect(url.startsWith('https://wa.me/5521912345678?')).toBe(true)
    expect(url).not.toContain('555521')
  })
})

describe('checkout customer phone rejects garbage', () => {
  it('rejects non-phone text', async () => {
    const { parseBrazilWhatsapp } = await import('../js/whatsapp.js')
    expect(parseBrazilWhatsapp('abc').ok).toBe(false)
    expect(parseBrazilWhatsapp('123').ok).toBe(false)
    expect(parseBrazilWhatsapp('telefone').ok).toBe(false)
    expect(parseBrazilWhatsapp('21912345678').ok).toBe(true)
  })
})
