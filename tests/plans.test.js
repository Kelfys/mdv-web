import { describe, it, expect } from 'vitest'
import {
  getPlanPriceCooldownHours,
  getPriceCooldownRemaining,
  formatPriceCooldownRemaining,
  getPlanById,
  getPlanProductLimit,
  getPlanProductImageLimit,
  canCreateProduct,
  canAddProductImage,
  renderSubscriptionPlanCards,
} from '../js/plans.js'

describe('plan price cooldown', () => {
  it('returns hours per plan', () => {
    expect(getPlanPriceCooldownHours('free')).toBe(24)
    expect(getPlanPriceCooldownHours('premium')).toBeNull()
  })

  it('blocks price change inside cooldown window', () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const result = getPriceCooldownRemaining('free', recent)
    expect(result.allowed).toBe(false)
    expect(result.remainingMs).toBeGreaterThan(0)
  })

  it('allows price change after cooldown', () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const result = getPriceCooldownRemaining('free', old)
    expect(result.allowed).toBe(true)
  })

  it('formats remaining time', () => {
    expect(formatPriceCooldownRemaining(90 * 60 * 1000)).toMatch(/h/)
  })

  it('resolves plan by id', () => {
    expect(getPlanById('starter').name).toBe('Starter')
    expect(getPlanById('plus').name).toBe('Plus')
  })
})

describe('plan catalog limits', () => {
  it('defines product and image limits per plan', () => {
    expect(getPlanProductLimit('free')).toBe(6)
    expect(getPlanProductImageLimit('free')).toBe(2)
    expect(getPlanProductLimit('starter')).toBe(15)
    expect(getPlanProductImageLimit('starter')).toBe(10)
    expect(getPlanProductLimit('plus')).toBe(30)
    expect(getPlanProductImageLimit('plus')).toBe(30)
    expect(getPlanProductLimit('premium')).toBe(80)
    expect(getPlanProductImageLimit('premium')).toBe(80)
  })

  it('blocks product creation at plan cap', () => {
    expect(canCreateProduct('free', 5)).toBe(true)
    expect(canCreateProduct('free', 6)).toBe(false)
    expect(canCreateProduct('premium', 79)).toBe(true)
    expect(canCreateProduct('premium', 80)).toBe(false)
  })

  it('blocks new product images at plan cap', () => {
    expect(canAddProductImage('starter', 9)).toBe(true)
    expect(canAddProductImage('starter', 10)).toBe(false)
    expect(canAddProductImage('starter', 10, true)).toBe(true)
  })
})

describe('renderSubscriptionPlanCards', () => {
  it('renders public plan buttons', () => {
    const html = renderSubscriptionPlanCards()
    expect(html).toContain('Enviar comprovante — Starter')
    expect(html).not.toContain('Seu plano atual')
  })

  it('highlights current plan in dashboard mode', () => {
    const html = renderSubscriptionPlanCards({ currentPlanId: 'starter' })
    expect(html).toContain('plan-card--current')
    expect(html).toContain('Seu plano atual')
    expect(html).toContain('Assinar — Plus')
    expect(html).not.toContain('Assinar — Starter')
  })
})