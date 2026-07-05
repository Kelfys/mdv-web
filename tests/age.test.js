import { describe, it, expect } from 'vitest'
import {
  MIN_REGISTRATION_AGE,
  getMaxBirthDateForRegistration,
  calculateAge,
  validateRegistrationBirthDate,
} from '../js/utils.js'

describe('registration age', () => {
  const now = Date.parse('2026-07-05T12:00:00Z')

  it('requires minimum age constant', () => {
    expect(MIN_REGISTRATION_AGE).toBe(18)
  })

  it('computes max birth date', () => {
    expect(getMaxBirthDateForRegistration(now)).toBe('2008-07-05')
  })

  it('calculates age correctly', () => {
    expect(calculateAge('2000-01-01', now)).toBe(26)
    expect(calculateAge('2010-07-06', now)).toBe(15)
  })

  it('rejects minors', () => {
    const result = validateRegistrationBirthDate('2015-01-01', now)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('18')
  })

  it('accepts adults', () => {
    const result = validateRegistrationBirthDate('1995-03-20', now)
    expect(result.ok).toBe(true)
    expect(result.birthDate).toBe('1995-03-20')
  })
})