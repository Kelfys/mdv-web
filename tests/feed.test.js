import { describe, it, expect } from 'vitest'
import {
  getStoreFeedScore,
  getProductFeedScore,
  getProductStoreId,
  rankStoresForFeed,
  rankProductsForFeed,
  buildHomeFeed,
  paginateFeedItems,
  FEED_PAGE_SIZE,
} from '../js/feed.js'

const stores = [
  { id: 'a', name: 'Loja Free', plan_id: 'free', created_at: '2024-01-01T00:00:00Z', city: 'Rio' },
  { id: 'b', name: 'Loja Premium', plan_id: 'premium', created_at: '2024-01-01T00:00:00Z', city: 'Rio' },
  { id: 'c', name: 'Loja Plus', plan_id: 'plus', created_at: new Date().toISOString(), city: 'SP' },
]

const products = [
  {
    id: 'p1',
    store_id: 'a',
    name: 'Produto antigo',
    created_at: '2024-01-01T00:00:00Z',
    likes_count: 1,
  },
  {
    id: 'p2',
    store_id: 'b',
    name: 'Produto popular',
    created_at: new Date().toISOString(),
    likes_count: 10,
  },
]

describe('feed algorithm', () => {
  it('prioritizes premium stores over free', () => {
    const ranked = rankStoresForFeed(stores)
    expect(ranked[0].plan_id).toBe('premium')
  })

  it('boosts stores with more favorites and catalog likes', () => {
    const now = Date.parse('2026-01-01T00:00:00Z')
    const quiet = { ...stores[0], favorites_count: 0, likes_count: 0 }
    const popular = { ...stores[0], favorites_count: 40, likes_count: 80 }
    expect(getStoreFeedScore(popular, { now })).toBeGreaterThan(getStoreFeedScore(quiet, { now }))
  })

  it('does not let extreme store engagement dominate linearly', () => {
    const now = Date.parse('2026-01-01T00:00:00Z')
    const base = { ...stores[0], favorites_count: 0, likes_count: 0 }
    const moderate = { ...stores[0], favorites_count: 10, likes_count: 20 }
    const extreme = { ...stores[0], favorites_count: 500, likes_count: 2000 }
    const diff = getStoreFeedScore(extreme, { now }) - getStoreFeedScore(moderate, { now })
    expect(diff).toBeGreaterThan(0)
    expect(diff).toBeLessThan(4)
    expect(getStoreFeedScore(moderate, { now })).toBeGreaterThan(getStoreFeedScore(base, { now }))
  })

  it('boosts search matches', () => {
    const score = getStoreFeedScore(stores[0], { search: 'Loja Free' })
    const base = getStoreFeedScore(stores[0])
    expect(score).toBeGreaterThan(base)
  })

  it('ranks products by engagement', () => {
    const ranked = rankProductsForFeed(products)
    expect(ranked[0].id).toBe('p2')
  })

  it('does not let extreme like counts dominate linearly', () => {
    const now = Date.parse('2026-01-01T00:00:00Z')
    const base = { created_at: '2025-06-01T00:00:00Z', store_id: 'a' }
    const moderate = { id: 'm', ...base, likes_count: 8 }
    const extreme = { id: 'e', ...base, likes_count: 500 }
    const diff = getProductFeedScore(extreme, { now }) - getProductFeedScore(moderate, { now })
    expect(diff).toBeGreaterThan(0)
    expect(diff).toBeLessThan(5)
  })

  it('boosts products from higher plan stores', () => {
    const now = Date.parse('2026-01-01T00:00:00Z')
    const base = { created_at: '2025-06-01T00:00:00Z', likes_count: 5 }
    const low = { id: 'x', store_id: 'a', ...base, store: { plan_id: 'free' } }
    const high = { id: 'y', store_id: 'b', ...base, store: { plan_id: 'premium' } }
    expect(getProductFeedScore(high, { now })).toBeGreaterThan(getProductFeedScore(low, { now }))
  })

  it('boosts products from stores with higher engagement', () => {
    const now = Date.parse('2026-01-01T00:00:00Z')
    const base = { created_at: '2025-06-01T00:00:00Z', likes_count: 3, store: { plan_id: 'free' } }
    const quiet = { id: 'q', store_id: 'a', ...base, store: { ...base.store, favorites_count: 0, likes_count: 0 } }
    const popular = { id: 'p', store_id: 'a', ...base, store: { ...base.store, favorites_count: 30, likes_count: 60 } }
    expect(getProductFeedScore(popular, { now })).toBeGreaterThan(getProductFeedScore(quiet, { now }))
  })

  it('resolves store id from nested store', () => {
    expect(getProductStoreId({ store: { id: 'nested' } })).toBe('nested')
    expect(getProductStoreId({ store_id: 'flat' })).toBe('flat')
  })

  it('builds mixed feed with ads and diversity', () => {
    const ads = [{ id: 'ad1', title: 'Promo', message: 'Oferta', store: { slug: 'loja' } }]
    const items = buildHomeFeed(stores, products, [], ads, { now: Date.now() })
    expect(items[0].kind).toBe('ad')
    expect(items.some((i) => i.kind === 'store')).toBe(true)
    expect(items.some((i) => i.kind === 'product')).toBe(true)

    const productItems = items.filter((i) => i.kind === 'product')
    if (productItems.length >= 2) {
      expect(productItems[0].product.store_id).not.toBe(productItems[1].product.store_id)
    }
  })

  it('paginates feed into pages of 44 cards', () => {
    expect(FEED_PAGE_SIZE).toBe(44)
    const items = Array.from({ length: 90 }, (_, i) => ({ kind: 'product', id: `p${i}` }))
    const page1 = paginateFeedItems(items, 1, FEED_PAGE_SIZE)
    expect(page1.items).toHaveLength(44)
    expect(page1.totalPages).toBe(3)
    expect(page1.total).toBe(90)

    const page2 = paginateFeedItems(items, 2, FEED_PAGE_SIZE)
    expect(page2.items).toHaveLength(44)
    expect(page2.items[0].id).toBe('p44')

    const page3 = paginateFeedItems(items, 3, FEED_PAGE_SIZE)
    expect(page3.items).toHaveLength(2)

    const overflow = paginateFeedItems(items, 99, FEED_PAGE_SIZE)
    expect(overflow.page).toBe(3)
  })
})