import { describe, it, expect } from 'vitest'
import {
  PAYMENT_METHODS,
  getPaymentMethodLabel,
  isValidPaymentMethod,
  normalizeStorePaymentMethods,
  resolveStorePaymentMethods,
  getDefaultPaymentMethod,
} from '../js/payment.js'
import { buildOrderMessage } from '../js/whatsapp.js'

describe('payment methods', () => {
  it('lists checkout options', () => {
    expect(PAYMENT_METHODS.length).toBeGreaterThanOrEqual(3)
    expect(PAYMENT_METHODS.some((m) => m.id === 'pix')).toBe(true)
  })

  it('validates payment ids against store list', () => {
    expect(isValidPaymentMethod('pix', ['pix', 'cash'])).toBe(true)
    expect(isValidPaymentMethod('card', ['pix', 'cash'])).toBe(false)
  })

  it('normalizes empty store config to defaults', () => {
    expect(normalizeStorePaymentMethods(null)).toContain('pix')
    expect(normalizeStorePaymentMethods(['pix', 'invalid'])).toEqual(['pix'])
  })

  it('resolves store methods for checkout', () => {
    const methods = resolveStorePaymentMethods({ payment_methods: ['cash', 'card'] })
    expect(methods.map((m) => m.id)).toEqual(['cash', 'card'])
  })

  it('picks default from allowed list', () => {
    expect(getDefaultPaymentMethod(['cash', 'card'])).toBe('cash')
  })

  it('includes payment in whatsapp message', () => {
    const message = buildOrderMessage({
      items: [{ product: { name: 'Pão', price: 5 }, quantity: 2 }],
      total: 10,
      customerName: 'Ana',
      customerPhone: '21999999999',
      customerAddress: 'Rua A, 10',
      paymentMethod: 'pix',
    })
    expect(message).toContain(`Forma de pagamento: ${getPaymentMethodLabel('pix')}`)
  })
})