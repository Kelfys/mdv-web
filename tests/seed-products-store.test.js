import { describe, it, expect } from 'vitest'
import {
  isSeedProductsStore,
  isPublicMarketplaceStore,
  SEED_PRODUCTS_STORE_SLUG,
} from '../js/config.js'

describe('seed products store visibility', () => {
  it('detects seed store by slug string or object', () => {
    expect(isSeedProductsStore(SEED_PRODUCTS_STORE_SLUG)).toBe(true)
    expect(isSeedProductsStore({ slug: SEED_PRODUCTS_STORE_SLUG })).toBe(true)
    expect(isSeedProductsStore({ slug: 'loja-real', owner: { email: 'a@b.com' } })).toBe(false)
    expect(isSeedProductsStore({ slug: 'x', owner: { email: 'produtosfake@gmail.com' } })).toBe(true)
  })

  it('hides seed store from public marketplace listing helper', () => {
    expect(isPublicMarketplaceStore({ slug: SEED_PRODUCTS_STORE_SLUG })).toBe(false)
    expect(isPublicMarketplaceStore({ slug: 'padaria-do-joao' })).toBe(true)
  })
})
