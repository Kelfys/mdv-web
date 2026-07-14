import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

function createMockSupabase({ merchants = [] } = {}) {
  return {
    from: vi.fn((table) => {
      if (table !== 'users') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        }
      }
      return {
        select: vi.fn((cols) => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: merchants.map((m) => {
                if (String(cols).includes('stores')) {
                  return { id: m.id, name: m.name, email: m.email, stores: m.stores ?? [] }
                }
                return { id: m.id, name: m.name, email: m.email }
              }),
              error: null,
            }),
          })),
        })),
      }
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

describe('fetchMerchants', () => {
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

  it('returns all merchants by default', async () => {
    const merchants = [
      { id: 'm1', name: 'Ana', email: 'ana@test.com', stores: [{ id: 's1' }] },
      { id: 'm2', name: 'Bruno', email: 'bruno@test.com', stores: [] },
    ]
    const api = await loadApi(createMockSupabase({ merchants }))
    const rows = await api.fetchMerchants()
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.id)).toEqual(['m1', 'm2'])
  })

  it('filters to merchants without a store when withoutStore is true', async () => {
    const merchants = [
      { id: 'm1', name: 'Ana', email: 'ana@test.com', stores: [{ id: 's1' }] },
      { id: 'm2', name: 'Bruno', email: 'bruno@test.com', stores: [] },
      { id: 'm3', name: 'Carla', email: 'carla@test.com', stores: [{ id: 's2' }, { id: 's3' }] },
    ]
    const api = await loadApi(createMockSupabase({ merchants }))
    const rows = await api.fetchMerchants({ withoutStore: true })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({ id: 'm2', name: 'Bruno', email: 'bruno@test.com' })
    expect(rows[0].stores).toBeUndefined()
  })
})

describe('createStoreAsAdmin owner guard', () => {
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

  it('rejects when the merchant already has a store', async () => {
    const mockClient = {
      from: vi.fn((table) => {
        if (table === 'stores') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'store-1', name: 'Loja Existente' },
                  error: null,
                }),
              })),
            })),
            insert: vi.fn(() => {
              throw new Error('insert should not be called')
            }),
          }
        }
        if (table === 'neighborhoods') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'n1', city: 'Rio', state: 'RJ', active: true },
                  error: null,
                }),
              })),
            })),
          }
        }
        return { select: vi.fn() }
      }),
    }
    const api = await loadApi(mockClient)
    await expect(
      api.createStoreAsAdmin({
        owner_id: 'm1',
        name: 'Nova Loja',
        whatsapp: '21999999999',
        neighborhood_id: 'n1',
        category_id: 'c1',
      }),
    ).rejects.toThrow(/já tem a loja/i)
  })
})
