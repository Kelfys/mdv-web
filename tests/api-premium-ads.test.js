import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const PREMIUM_ONLY_ERROR = 'Anúncios no feed são exclusivos do plano Premium.'
const MONTHLY_LIMIT_ERROR = 'Limite de 2 anúncios por mês no plano Premium.'

function chainable(resolveValue) {
  const resolve = () => Promise.resolve(resolveValue())
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    single: vi.fn(resolve),
    then: (onFulfilled, onRejected) => resolve().then(onFulfilled, onRejected),
  }
  return builder
}

function createMockSupabase({
  planId = 'premium',
  status = 'approved',
  subscriptionStatus = 'active',
  adsThisMonth = 0,
} = {}) {
  return {
    from: vi.fn((table) => {
      if (table === 'stores') {
        return chainable(() => ({
          data: { plan_id: planId, status, subscription_status: subscriptionStatus },
          error: null,
        }))
      }
      if (table === 'store_ads') {
        return {
          select: vi.fn((cols, opts) => {
            if (opts?.head) {
              return chainable(() => ({ count: adsThisMonth, error: null }))
            }
            return chainable(() => ({ data: { id: 'ad-1' }, error: null }))
          }),
          eq: vi.fn(function () { return this }),
          gte: vi.fn(function () { return this }),
          insert: vi.fn(() => chainable(() => ({
            data: { id: 'ad-new', title: 'Promo', message: 'Oferta especial hoje' },
            error: null,
          }))),
        }
      }
      return chainable(() => ({ data: null, error: null }))
    }),
  }
}

describe('createStoreAd plan limits', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { pathname: '/', origin: 'http://localhost' } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('rejects ads for non-premium plans', async () => {
    vi.doMock('../js/db.js', () => ({
      requireClient: vi.fn(async () => createMockSupabase({ planId: 'plus' })),
      getSupabase: vi.fn(),
      isSupabaseConfigured: () => true,
    }))
    vi.doMock('../js/uploads.js', () => ({
      uploadImage: vi.fn(),
      STORAGE_BUCKETS: { products: 'products' },
    }))

    const { createStoreAd } = await import('../js/api.js')
    await expect(createStoreAd('store-1', { title: 'Promo', message: 'Oferta especial hoje' }))
      .rejects.toThrow(PREMIUM_ONLY_ERROR)
  })

  it('rejects ads when monthly limit is reached', async () => {
    vi.doMock('../js/db.js', () => ({
      requireClient: vi.fn(async () => createMockSupabase({ planId: 'premium', adsThisMonth: 2 })),
      getSupabase: vi.fn(),
      isSupabaseConfigured: () => true,
    }))
    vi.doMock('../js/uploads.js', () => ({
      uploadImage: vi.fn(),
      STORAGE_BUCKETS: { products: 'products' },
    }))

    const { createStoreAd } = await import('../js/api.js')
    await expect(createStoreAd('store-1', { title: 'Promo', message: 'Oferta especial hoje' }))
      .rejects.toThrow(MONTHLY_LIMIT_ERROR)
  })

  it('allows premium store under monthly limit', async () => {
    vi.doMock('../js/db.js', () => ({
      requireClient: vi.fn(async () => createMockSupabase({ planId: 'premium', adsThisMonth: 1 })),
      getSupabase: vi.fn(),
      isSupabaseConfigured: () => true,
    }))
    vi.doMock('../js/uploads.js', () => ({
      uploadImage: vi.fn(),
      STORAGE_BUCKETS: { products: 'products' },
    }))

    const { createStoreAd } = await import('../js/api.js')
    const ad = await createStoreAd('store-1', { title: 'Promo', message: 'Oferta especial hoje' })
    expect(ad.id).toBe('ad-new')
  })
})