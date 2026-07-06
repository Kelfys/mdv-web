import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.stubGlobal('localStorage', {
  store: {},
  getItem(key) { return this.store[key] ?? null },
  setItem(key, value) { this.store[key] = value },
  removeItem(key) { delete this.store[key] },
})
import {
  getSelectedNeighborhoodId,
  setSelectedNeighborhoodId,
  getModeratorNeighborhoodId,
  getStaffNeighborhoodScope,
  formatNeighborhoodLabel,
} from '../js/neighborhood.js'
const NEIGHBORHOOD_STORAGE_KEY = 'maredevendas-neighborhood'

describe('neighborhood helpers', () => {
  beforeEach(() => {
    localStorage.removeItem(NEIGHBORHOOD_STORAGE_KEY)
  })

  it('persists selected neighborhood in localStorage', () => {
    setSelectedNeighborhoodId('abc-123')
    expect(getSelectedNeighborhoodId()).toBe('abc-123')
    setSelectedNeighborhoodId(null)
    expect(getSelectedNeighborhoodId()).toBeNull()
  })

  it('formats neighborhood label with city', () => {
    expect(formatNeighborhoodLabel({ name: 'Copacabana', city: 'Rio de Janeiro' }))
      .toBe('Copacabana · Rio de Janeiro')
  })

  it('scopes moderator to assigned neighborhood', () => {
    const mod = { role: 'moderator', neighborhood_id: 'n1' }
    expect(getModeratorNeighborhoodId(mod)).toBe('n1')
    expect(getStaffNeighborhoodScope(mod, 'moderator')).toBe('n1')
    expect(getStaffNeighborhoodScope(mod, 'admin')).toBeUndefined()
  })
})