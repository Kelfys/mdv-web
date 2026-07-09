import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

function createMockSupabase({ storeId = 'store-1' } = {}) {
  const builder = {
    select: vi.fn(function () { return this }),
    eq: vi.fn(function () { return this }),
    order: vi.fn(function () { return this }),
    insert: vi.fn(function () { return this }),
    update: vi.fn(function () { return this }),
    delete: vi.fn(function () { return this }),
    single: vi.fn(() => Promise.resolve({
      data: { id: 'ad-staff-1', title: 'Promo staff', store_id: storeId, status: 'approved' },
      error: null,
    })),
    then: (onFulfilled, onRejected) => Promise.resolve({
      data: [{ id: 'ad-1', title: 'Anúncio', store: { id: storeId, name: 'Loja' } }],
      error: null,
    }).then(onFulfilled, onRejected),
  }

  return {
    from: vi.fn(() => builder),
    builder,
  }
}

describe('staff store ads API', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { pathname: '/', origin: 'http://localhost' } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('createStoreAdAsStaff publishes immediately by default', async () => {
    const mock = createMockSupabase()
    vi.doMock('../js/db.js', () => ({
      requireClient: vi.fn(async () => mock),
      getSupabase: vi.fn(),
      isSupabaseConfigured: () => true,
    }))
    vi.doMock('../js/uploads.js', () => ({
      uploadImage: vi.fn(),
      STORAGE_BUCKETS: { products: 'products' },
    }))

    const { createStoreAdAsStaff } = await import('../js/api.js')
    const ad = await createStoreAdAsStaff('store-1', {
      title: 'Promo staff',
      message: 'Oferta especial hoje no bairro',
    })
    expect(ad.id).toBe('ad-staff-1')
    expect(mock.builder.insert).toHaveBeenCalledWith(expect.objectContaining({
      store_id: 'store-1',
      status: 'approved',
      is_extra: false,
      fee_amount: 0,
    }))
  })

  it('createStoreAdAsStaff can leave ad pending', async () => {
    const mock = createMockSupabase()
    vi.doMock('../js/db.js', () => ({
      requireClient: vi.fn(async () => mock),
      getSupabase: vi.fn(),
      isSupabaseConfigured: () => true,
    }))
    vi.doMock('../js/uploads.js', () => ({
      uploadImage: vi.fn(),
      STORAGE_BUCKETS: { products: 'products' },
    }))

    const { createStoreAdAsStaff } = await import('../js/api.js')
    await createStoreAdAsStaff('store-1', {
      title: 'Promo staff',
      message: 'Oferta especial hoje no bairro',
      publishNow: false,
    })
    expect(mock.builder.insert).toHaveBeenCalledWith(expect.not.objectContaining({
      status: 'approved',
    }))
  })

  it('fetchAllStoreAdsAdmin returns ads list', async () => {
    const mock = createMockSupabase()
    vi.doMock('../js/db.js', () => ({
      requireClient: vi.fn(async () => mock),
      getSupabase: vi.fn(),
      isSupabaseConfigured: () => true,
    }))
    vi.doMock('../js/uploads.js', () => ({
      uploadImage: vi.fn(),
      STORAGE_BUCKETS: { products: 'products' },
    }))

    const { fetchAllStoreAdsAdmin } = await import('../js/api.js')
    const ads = await fetchAllStoreAdsAdmin()
    expect(ads).toHaveLength(1)
    expect(ads[0].title).toBe('Anúncio')
  })

  it('deleteStoreAdAsStaff removes ad', async () => {
    const mock = createMockSupabase()
    vi.doMock('../js/db.js', () => ({
      requireClient: vi.fn(async () => mock),
      getSupabase: vi.fn(),
      isSupabaseConfigured: () => true,
    }))
    vi.doMock('../js/uploads.js', () => ({
      uploadImage: vi.fn(),
      STORAGE_BUCKETS: { products: 'products' },
    }))

    const { deleteStoreAdAsStaff } = await import('../js/api.js')
    await deleteStoreAdAsStaff('ad-staff-1')
    expect(mock.builder.delete).toHaveBeenCalled()
    expect(mock.builder.eq).toHaveBeenCalledWith('id', 'ad-staff-1')
  })
})