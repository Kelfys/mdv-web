import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const FREE_IMAGE_LIMIT_ERROR =
  'O plano Gratuito permite imagens em até 1 produto(s). Assine um plano superior para liberar mais.'

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

describe('api free plan product images', () => {
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

  it('createProduct allows first image upload on free plan', async () => {
    const api = await loadApi(createMockSupabase({ planId: 'free', productCount: 0, catalogProducts: [] }))

    const created = await api.createProduct('store-1', productForm({ withImage: true }))

    expect(created).toMatchObject({ id: 'prod-new' })
    expect(uploadImage).toHaveBeenCalledTimes(1)
  })

  it('createProduct rejects second catalog item on free plan (limit 1)', async () => {
    const api = await loadApi(createMockSupabase({
      planId: 'free',
      productCount: 1,
      catalogProducts: [{ id: 'prod-1', image: 'https://legacy.example/old.jpg' }],
    }))

    await expect(api.createProduct('store-1', productForm({ withImage: true })))
      .rejects.toThrow(/permite até 1 itens no catálogo/)

    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('createProduct allows single catalog item without image on free plan', async () => {
    const api = await loadApi(createMockSupabase({ planId: 'free', productCount: 0 }))

    const created = await api.createProduct('store-1', productForm({ withImage: false }))

    expect(created).toMatchObject({ id: 'prod-new', name: 'Novo item' })
    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('updateProduct allows first image on free plan', async () => {
    const api = await loadApi(createMockSupabase({
      planId: 'free',
      catalogProducts: [],
      productRow: { store_id: 'store-1', image: null },
    }))

    const updated = await api.updateProduct('prod-1', { image: new File(['x'], 'nova.jpg', { type: 'image/jpeg' }) })

    expect(updated).toMatchObject({ id: 'prod-1' })
    expect(uploadImage).toHaveBeenCalledTimes(1)
  })

  it('updateProduct allows image replacement on free when product already had image', async () => {
    const api = await loadApi(createMockSupabase({
      planId: 'free',
      catalogProducts: [{ id: 'prod-1', image: 'https://legacy.example/old.jpg' }],
      productRow: { store_id: 'store-1', image: 'https://legacy.example/old.jpg' },
    }))

    const updated = await api.updateProduct('prod-1', { image: new File(['x'], 'troca.jpg', { type: 'image/jpeg' }) })

    expect(updated).toMatchObject({ id: 'prod-1' })
    expect(uploadImage).toHaveBeenCalledTimes(1)
  })

  it('updateProduct rejects new image on another product when free limit is reached', async () => {
    const api = await loadApi(createMockSupabase({
      planId: 'free',
      catalogProducts: [{ id: 'prod-other', image: 'https://legacy.example/other.jpg' }],
      productRow: { store_id: 'store-1', image: null },
    }))

    await expect(api.updateProduct('prod-1', { image: new File(['x'], 'nova.jpg', { type: 'image/jpeg' }) }))
      .rejects.toThrow(FREE_IMAGE_LIMIT_ERROR)

    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('updateProduct without image file does not trigger upload on free plan', async () => {
    const api = await loadApi(createMockSupabase({ planId: 'free' }))

    const updated = await api.updateProduct('prod-1', { name: 'Só nome' })

    expect(updated).toMatchObject({ id: 'prod-1', name: 'Item atualizado' })
    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('createProduct allows image upload on plus plan', async () => {
    const api = await loadApi(createMockSupabase({ planId: 'plus', productCount: 0, catalogProducts: [] }))

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