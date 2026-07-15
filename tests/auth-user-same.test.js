import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('loadUser skips notify when profile unchanged', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: { pathname: '/', origin: 'http://localhost:8080' },
      localStorage: {
        store: {},
        getItem(k) { return this.store[k] ?? null },
        setItem(k, v) { this.store[k] = String(v) },
        removeItem(k) { delete this.store[k] },
      },
    })
    vi.stubGlobal('document', {
      documentElement: { setAttribute() {} },
      querySelector() { return null },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
    vi.doUnmock('../js/api.js')
  })

  it('does not notify on second load with same user (TOKEN_REFRESHED case)', async () => {
    const profile = {
      id: 'u1',
      role: 'admin',
      email: 'a@b.com',
      name: 'Admin',
      can_approve_plan_changes: false,
      neighborhood_id: null,
    }
    vi.doMock('../js/api.js', () => ({
      getCurrentUser: vi.fn().mockResolvedValue(profile),
      signOut: vi.fn(),
    }))

    const state = await import('../js/state.js')
    const listener = vi.fn()
    state.onAuthChange(listener)

    await state.loadUser()
    expect(listener).toHaveBeenCalledTimes(1)

    await state.loadUser()
    expect(listener).toHaveBeenCalledTimes(1)

    await state.loadUser({ forceNotify: true })
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
