import { describe, it, expect } from 'vitest'
import {
  getPlanPriceCooldownHours,
  getPriceCooldownRemaining,
  formatPriceCooldownRemaining,
  getPlanById,
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
  })
})