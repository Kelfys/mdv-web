import { describe, it, expect } from 'vitest'
import {
  getStoreFeedScore,
  getProductFeedScore,
  getProductStoreId,
  rankStoresForFeed,
  rankProductsForFeed,
  buildHomeFeed,
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

  it('boosts search matches', () => {
    const score = getStoreFeedScore(stores[0], { search: 'Loja Free' })
    const base = getStoreFeedScore(stores[0])
    expect(score).toBeGreaterThan(base)
  })

  it('ranks products by engagement', () => {
    const ranked = rankProductsForFeed(products)
    expect(ranked[0].id).toBe('p2')
  })

  it('boosts products from higher plan stores', () => {
    const now = Date.parse('2026-01-01T00:00:00Z')
    const base = { created_at: '2025-06-01T00:00:00Z', likes_count: 5 }
    const low = { id: 'x', store_id: 'a', ...base, store: { plan_id: 'free' } }
    const high = { id: 'y', store_id: 'b', ...base, store: { plan_id: 'premium' } }
    expect(getProductFeedScore(high, { now })).toBeGreaterThan(getProductFeedScore(low, { now }))
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
})