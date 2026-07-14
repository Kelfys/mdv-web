import { describe, it, expect } from 'vitest'
import {
  SUBSCRIPTION_PERIOD_DAYS,
  PLAN_RENEWAL_WARNING_HOURS,
  isPaidStorePlan,
  addSubscriptionPeriod,
  resolveSubscriptionExpiresAt,
  getPlanRenewalState,
  formatRenewalRemaining,
  storeNeedsRenewalAttention,
  pickProductIdsToKeepActive,
  storeWasDowngradedToFree,
} from '../js/plan-renewal.js'

describe('plan renewal', () => {
  const now = new Date('2026-07-08T12:00:00.000Z')

  it('identifies paid plans', () => {
    expect(isPaidStorePlan('free')).toBe(false)
    expect(isPaidStorePlan('plus')).toBe(true)
    expect(isPaidStorePlan('premium')).toBe(true)
  })

  it('adds subscription period in days', () => {
    const expires = addSubscriptionPeriod(now)
    const diffDays = (new Date(expires).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBe(SUBSCRIPTION_PERIOD_DAYS)
  })

  it('extends renewal from current expiry when still active', () => {
    const currentExpiresAt = '2026-07-20T12:00:00.000Z'
    const next = resolveSubscriptionExpiresAt({
      planId: 'plus',
      currentExpiresAt,
      isRenewal: true,
    }, now)
    expect(new Date(next).toISOString()).toBe('2026-08-19T12:00:00.000Z')
  })

  it('starts renewal from now when already expired', () => {
    const currentExpiresAt = '2026-07-01T12:00:00.000Z'
    const next = resolveSubscriptionExpiresAt({
      planId: 'premium',
      currentExpiresAt,
      isRenewal: true,
    }, now)
    expect(new Date(next).toISOString()).toBe('2026-08-07T12:00:00.000Z')
  })

  it('returns null expiry for free plan', () => {
    expect(resolveSubscriptionExpiresAt({ planId: 'free' }, now)).toBeNull()
  })

  it('warns within 72 hours of expiry', () => {
    const expiresAt = new Date(now.getTime() + (PLAN_RENEWAL_WARNING_HOURS - 1) * 60 * 60 * 1000).toISOString()
    const state = getPlanRenewalState({ plan_id: 'plus', subscription_expires_at: expiresAt }, now)
    expect(state.status).toBe('warning')
    expect(state.hoursRemaining).toBeLessThanOrEqual(PLAN_RENEWAL_WARNING_HOURS)
  })

  it('marks expired subscriptions', () => {
    const expiresAt = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    const state = getPlanRenewalState({ plan_id: 'premium', subscription_expires_at: expiresAt }, now)
    expect(state.status).toBe('expired')
    expect(storeNeedsRenewalAttention({ plan_id: 'premium', subscription_expires_at: expiresAt }, now)).toBe(true)
  })

  it('ignores free plans', () => {
    expect(getPlanRenewalState({ plan_id: 'free' }, now).status).toBe('not_applicable')
  })

  it('formats remaining time', () => {
    expect(formatRenewalRemaining(0)).toBe('agora')
    expect(formatRenewalRemaining(5 * 60 * 60 * 1000)).toMatch(/5/)
    expect(formatRenewalRemaining(3 * 24 * 60 * 60 * 1000)).toMatch(/3/)
  })

  it('keeps only the single most recently added product active on free', () => {
    const products = [
      { id: 'a', created_at: '2026-01-01T00:00:00.000Z', active: true },
      { id: 'b', created_at: '2026-03-01T00:00:00.000Z', active: true },
      { id: 'c', created_at: '2026-02-01T00:00:00.000Z', active: true },
      { id: 'd', created_at: '2026-04-01T00:00:00.000Z', active: true },
    ]
    const keep = pickProductIdsToKeepActive(products)
    expect([...keep]).toEqual(['d'])
  })

  it('detects stores downgraded to free with inactive catalog items', () => {
    const store = { plan_id: 'free' }
    const products = [
      { id: '1', active: true, created_at: '2026-04-01T00:00:00.000Z' },
      { id: '2', active: false, created_at: '2026-03-01T00:00:00.000Z' },
      { id: '3', active: false, created_at: '2026-02-01T00:00:00.000Z' },
    ]
    expect(storeWasDowngradedToFree(store, products)).toBe(true)
    expect(storeWasDowngradedToFree(store, [{ id: '1', active: true, created_at: '2026-04-01T00:00:00.000Z' }])).toBe(false)
  })
})