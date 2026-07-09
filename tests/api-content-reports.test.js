/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

function chainable(resolveValue) {
  const resolve = () => Promise.resolve(resolveValue())
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(resolve),
    insert: vi.fn(resolve),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(resolve),
        single: vi.fn(resolve),
      })),
    })),
    then: (onFulfilled, onRejected) => resolve().then(onFulfilled, onRejected),
  }
  return builder
}

function createMockSupabase({
  storeOwnerId = 'other-owner',
  productOwnerId = 'other-owner',
  insertError = null,
} = {}) {
  const reportInsert = vi.fn((payload) => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({
        data: {
          id: 'report-1',
          target_type: payload.target_type,
          store_id: payload.store_id,
          product_id: payload.product_id ?? null,
          reason: payload.reason,
        },
        error: insertError,
      })),
    })),
  }))

  const mock = {
    reportInsert,
    from: vi.fn((table) => {
      if (table === 'stores') {
        return chainable(() => ({
          data: { id: 'store-1', owner_id: storeOwnerId },
          error: null,
        }))
      }
      if (table === 'products') {
        return chainable(() => ({
          data: { id: 'product-1', store_id: 'store-1', store: { owner_id: productOwnerId } },
          error: null,
        }))
      }
      if (table === 'content_reports') {
        const builder = chainable(() => ({ data: { id: 'report-1' }, error: insertError }))
        builder.insert = reportInsert
        return builder
      }
      return chainable(() => ({ data: null, error: null }))
    }),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'staff-1' } } })),
    },
  }
  return mock
}

async function loadApi(mockClient) {
  vi.resetModules()
  vi.doMock('../js/db.js', () => ({
    requireClient: vi.fn().mockResolvedValue(mockClient),
    isSupabaseConfigured: () => true,
    getSupabase: vi.fn(),
  }))
  return import('../js/api.js')
}

describe('content reports', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('submits a store report for another users store', async () => {
    const { submitStoreReport } = await loadApi(createMockSupabase())
    await expect(submitStoreReport('user-1', 'store-1', 'spam', 'detalhe')).resolves.toMatchObject({
      id: 'report-1',
    })
  })

  it('rejects reporting own store', async () => {
    const { submitStoreReport } = await loadApi(createMockSupabase({ storeOwnerId: 'user-1' }))
    await expect(submitStoreReport('user-1', 'store-1', 'spam', 'comentário')).rejects.toThrow(/própria loja/i)
  })

  it('rejects reporting own product', async () => {
    const { submitProductReport } = await loadApi(createMockSupabase({ productOwnerId: 'user-1' }))
    await expect(submitProductReport('user-1', 'product-1', 'spam', 'comentário')).rejects.toThrow(/própria loja/i)
  })

  it('requires a report comment', async () => {
    const { submitProductReport } = await loadApi(createMockSupabase())
    await expect(submitProductReport('user-1', 'product-1', 'spam', '   ')).rejects.toThrow(/comentário/i)
  })

  it('requires a valid report reason', async () => {
    const { submitStoreReport } = await loadApi(createMockSupabase())
    await expect(submitStoreReport('user-1', 'store-1', 'invalid')).rejects.toThrow(/motivo/i)
  })

  it('allows merchants to report another store', async () => {
    const { submitStoreReport } = await loadApi(createMockSupabase({ storeOwnerId: 'other-owner' }))
    await expect(submitStoreReport('merchant-1', 'store-1', 'spam', 'loja suspeita')).resolves.toMatchObject({
      id: 'report-1',
      target_type: 'store',
    })
  })

  it('submits a product report for another users product', async () => {
    const mock = createMockSupabase()
    const { submitProductReport } = await loadApi(mock)
    await expect(submitProductReport('user-1', 'product-1', 'inappropriate', 'conteúdo impróprio'))
      .resolves.toMatchObject({
        id: 'report-1',
        target_type: 'product',
        store_id: 'store-1',
        product_id: 'product-1',
        reason: 'inappropriate',
      })

    expect(mock.reportInsert).toHaveBeenCalledWith(expect.objectContaining({
      reporter_id: 'user-1',
      target_type: 'product',
      store_id: 'store-1',
      product_id: 'product-1',
      reason: 'inappropriate',
      details: 'conteúdo impróprio',
    }))
  })

  it('submits a store report with target_type store and no product_id', async () => {
    const mock = createMockSupabase()
    const { submitStoreReport } = await loadApi(mock)
    await expect(submitStoreReport('user-1', 'store-1', 'spam', 'conteúdo inadequado')).resolves.toMatchObject({
      target_type: 'store',
      product_id: null,
    })

    expect(mock.reportInsert).toHaveBeenCalledWith(expect.objectContaining({
      reporter_id: 'user-1',
      target_type: 'store',
      store_id: 'store-1',
      reason: 'spam',
      details: 'conteúdo inadequado',
    }))
    expect(mock.reportInsert.mock.calls[0][0]).not.toHaveProperty('product_id')
  })
})