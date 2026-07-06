import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const FREE_IMAGE_ERROR =
  'O plano Gratuito não permite imagens nos produtos. Assine um plano pago para enviar fotos no catálogo.'

const uploadImage = vi.fn().mockResolvedValue('https://cdn.example.com/product.jpg')

function chainable(resolveValue) {
  const resolve = () => Promise.resolve(resolveValue())
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn(resolve),
    then: (onFulfilled, onRejected) => resolve().then(onFulfilled, onRejected),
  }
  return builder
}

function createMockSupabase({
  planId = 'free',
  productCount = 0,
  catalogProducts = [],
  productRow = { store_id: 'store-1', image: null },
} = {}) {
  return {
    from: vi.fn((table) => {
      if (table === 'stores') {
        return chainable(() => ({ data: { plan_id: planId }, error: null }))
      }

      if (table === 'products') {
        return {
          select: vi.fn((cols, opts) => {
            if (opts?.head) {
              return chainable(() => ({ count: productCount, error: null }))
            }
            if (cols === 'store_id, image') {
              return chainable(() => ({ data: productRow, error: null }))
            }
            if (cols === 'item_type') {
              return chainable(() => ({ data: { item_type: 'product' }, error: null }))
            }
            if (cols === 'id, image') {
              return chainable(() => ({ data: catalogProducts, error: null }))
            }
            return chainable(() => ({ data: catalogProducts, error: null }))
          }),
          eq: vi.fn(function () { return this }),
          insert: vi.fn(() => chainable(() => ({
            data: { id: 'prod-new', name: 'Novo item', image: null },
            error: null,
          }))),
          update: vi.fn(() => chainable(() => ({
            data: { id: 'prod-1', name: 'Item atualizado', image: 'https://cdn.example.com/product.jpg' },
            error: null,
          }))),
        }
      }

      return chainable(() => ({ data: null, error: null }))
    }),
  }
}

async function loadApi(mockClient) {
  vi.resetModules()
  vi.doMock('../js/db.js', () => ({
    requireClient: vi.fn().mockResolvedValue(mockClient),
    isSupabaseConfigured: () => true,
    getSupabase: vi.fn(),
  }))
  vi.doMock('../js/uploads.js', () => ({
    STORAGE_BUCKETS: { products: 'product-images', logos: 'store-logos', banners: 'store-banners' },
    uploadImage,
  }))
  return import('../js/api.js')
}

function productForm({ withImage = false } = {}) {
  return {
    name: 'Produto teste',
    description: 'Descrição',
    price: 19.9,
    category_id: '',
    item_type: 'product',
    stock: 5,
    active: true,
    ...(withImage ? { image: new File(['img'], 'foto.jpg', { type: 'image/jpeg' }) } : {}),
  }
}

describe('api free plan product image blocking', () => {
  beforeEach(() => {
    uploadImage.mockClear()
    vi.stubGlobal('window', {
      location: { pathname: '/', origin: 'http://localhost:8080' },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
    vi.doUnmock('../js/db.js')
    vi.doUnmock('../js/uploads.js')
  })

  it('createProduct rejects image upload on free plan', async () => {
    const api = await loadApi(createMockSupabase({ planId: 'free', productCount: 0 }))

    await expect(api.createProduct('store-1', productForm({ withImage: true })))
      .rejects.toThrow(FREE_IMAGE_ERROR)

    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('createProduct allows catalog item without image on free plan', async () => {
    const api = await loadApi(createMockSupabase({ planId: 'free', productCount: 1 }))

    const created = await api.createProduct('store-1', productForm({ withImage: false }))

    expect(created).toMatchObject({ id: 'prod-new', name: 'Novo item' })
    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('updateProduct rejects new image on free plan', async () => {
    const api = await loadApi(createMockSupabase({
      planId: 'free',
      productRow: { store_id: 'store-1', image: null },
    }))

    await expect(api.updateProduct('prod-1', { image: new File(['x'], 'nova.jpg', { type: 'image/jpeg' }) }))
      .rejects.toThrow(FREE_IMAGE_ERROR)

    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('updateProduct rejects image replacement on free plan even if product already had image', async () => {
    const api = await loadApi(createMockSupabase({
      planId: 'free',
      catalogProducts: [{ id: 'prod-1', image: 'https://legacy.example/old.jpg' }],
      productRow: { store_id: 'store-1', image: 'https://legacy.example/old.jpg' },
    }))

    await expect(api.updateProduct('prod-1', { image: new File(['x'], 'troca.jpg', { type: 'image/jpeg' }) }))
      .rejects.toThrow(FREE_IMAGE_ERROR)

    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('updateProduct without image file does not trigger upload on free plan', async () => {
    const api = await loadApi(createMockSupabase({ planId: 'free' }))

    const updated = await api.updateProduct('prod-1', { name: 'Só nome' })

    expect(updated).toMatchObject({ id: 'prod-1', name: 'Item atualizado' })
    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('createProduct allows image upload on starter plan', async () => {
    const api = await loadApi(createMockSupabase({ planId: 'starter', productCount: 0, catalogProducts: [] }))

    const created = await api.createProduct('store-1', productForm({ withImage: true }))

    expect(created).toMatchObject({ id: 'prod-new' })
    expect(uploadImage).toHaveBeenCalledTimes(1)
    expect(uploadImage).toHaveBeenCalledWith(
      'product-images',
      expect.stringMatching(/^store-1\//),
      expect.any(File),
    )
  })
})