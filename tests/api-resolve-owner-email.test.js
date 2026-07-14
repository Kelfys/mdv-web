import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

function createMockClient({
  user = null,
  existingStore = null,
  neighborhood = { id: 'n1', city: 'Rio', state: 'RJ', active: true },
  promoteResult = null,
  promoteError = null,
  insertResult = null,
} = {}) {
  return {
    from: vi.fn((table) => {
      if (table === 'users') {
        return {
          select: vi.fn(() => ({
            ilike: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: user, error: null }),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: promoteResult ?? { ...user, role: 'merchant' },
                    error: promoteError,
                  }),
                })),
              })),
            })),
          })),
        }
      }
      if (table === 'stores') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: existingStore, error: null }),
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: insertResult ?? { id: 'store-new', name: 'Nova Loja' },
                error: null,
              }),
            })),
          })),
        }
      }
      if (table === 'neighborhoods') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: neighborhood, error: null }),
            })),
          })),
        }
      }
      if (table === 'categories') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'c1' }, error: null }),
            })),
          })),
        }
      }
      return { select: vi.fn() }
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
  return import('../js/api.js')
}

describe('resolveOwnerForAdminStore', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: { pathname: '/', origin: 'http://localhost:8080' },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
    vi.doUnmock('../js/db.js')
  })

  it('rejects empty email', async () => {
    const api = await loadApi(createMockClient())
    await expect(api.resolveOwnerForAdminStore('')).rejects.toThrow(/e-mail/i)
  })

  it('rejects unknown user', async () => {
    const api = await loadApi(createMockClient({ user: null }))
    await expect(api.resolveOwnerForAdminStore('x@test.com')).rejects.toThrow(/não encontrado/i)
  })

  it('rejects admin as store owner', async () => {
    const api = await loadApi(createMockClient({
      user: { id: 'a1', name: 'Admin', email: 'admin@test.com', role: 'admin' },
    }))
    await expect(api.resolveOwnerForAdminStore('admin@test.com')).rejects.toThrow(/administrador/i)
  })

  it('rejects moderator as store owner', async () => {
    const api = await loadApi(createMockClient({
      user: { id: 'm1', name: 'Mod', email: 'mod@test.com', role: 'moderator' },
    }))
    await expect(api.resolveOwnerForAdminStore('mod@test.com')).rejects.toThrow(/moderador/i)
  })

  it('returns merchant user', async () => {
    const merchant = { id: 'm1', name: 'Ana', email: 'ana@test.com', role: 'merchant' }
    const api = await loadApi(createMockClient({ user: merchant }))
    const owner = await api.resolveOwnerForAdminStore('ana@test.com')
    expect(owner).toEqual(merchant)
  })

  it('promotes customer to merchant', async () => {
    const customer = { id: 'c1', name: 'Cliente', email: 'cli@test.com', role: 'customer' }
    const api = await loadApi(createMockClient({
      user: customer,
      promoteResult: { ...customer, role: 'merchant' },
    }))
    const owner = await api.resolveOwnerForAdminStore('cli@test.com')
    expect(owner.role).toBe('merchant')
    expect(owner.id).toBe('c1')
  })
})

describe('createStoreAsAdmin with owner_email', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: { pathname: '/', origin: 'http://localhost:8080' },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
    vi.doUnmock('../js/db.js')
  })

  it('creates store when owner_email resolves to merchant without store', async () => {
    const merchant = { id: 'm1', name: 'Ana', email: 'ana@test.com', role: 'merchant' }
    const mock = createMockClient({
      user: merchant,
      existingStore: null,
      insertResult: { id: 's1', name: 'Loja Ana', owner_id: 'm1' },
    })
    // assertCategoryExists path — allow missing category check if any
    const api = await loadApi(mock)
    const store = await api.createStoreAsAdmin({
      owner_email: 'ana@test.com',
      name: 'Loja Ana',
      whatsapp: '21999999999',
      neighborhood_id: 'n1',
      category_id: 'c1',
    })
    expect(store.id).toBe('s1')
    expect(mock.from).toHaveBeenCalledWith('stores')
  })

  it('rejects when merchant already has a store', async () => {
    const merchant = { id: 'm1', name: 'Ana', email: 'ana@test.com', role: 'merchant' }
    const api = await loadApi(createMockClient({
      user: merchant,
      existingStore: { id: 'store-1', name: 'Loja Existente' },
    }))
    await expect(
      api.createStoreAsAdmin({
        owner_email: 'ana@test.com',
        name: 'Outra',
        whatsapp: '21999999999',
        neighborhood_id: 'n1',
        category_id: 'c1',
      }),
    ).rejects.toThrow(/já tem a loja/i)
  })
})
