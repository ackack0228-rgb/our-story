import { describe, it, expect } from 'vitest'
import { todayLocalISODate, dayOfYear, computeDday, nextMilestone } from './date'

describe('todayLocalISODate', () => {
  it('formats a given date as local YYYY-MM-DD regardless of UTC offset', () => {
    // 2026-01-01 00:30 local time — would be 2025-12-31 in UTC+ zones if toISOString() were used
    const d = new Date(2026, 0, 1, 0, 30)
    expect(todayLocalISODate(d)).toBe('2026-01-01')
  })
})

describe('dayOfYear', () => {
  it('returns 1 for January 1st', () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1)
  })
  it('returns 32 for February 1st (non-leap year)', () => {
    expect(dayOfYear(new Date(2027, 1, 1))).toBe(32)
  })
})

describe('computeDday', () => {
  it('returns 0 on the start date itself', () => {
    expect(computeDday('2026-01-01', new Date(2026, 0, 1))).toBe(0)
  })
  it('returns 100 on day 100 after the start date', () => {
    expect(computeDday('2026-01-01', new Date(2026, 3, 11))).toBe(100)
  })
  it('returns 365 on the first anniversary', () => {
    expect(computeDday('2025-09-29', new Date(2026, 8, 29))).toBe(365)
  })
})

describe('nextMilestone', () => {
  it('returns 100 when diff is below 100', () => {
    expect(nextMilestone(42)).toBe(100)
  })
  it('returns the same value when diff lands exactly on a milestone', () => {
    expect(nextMilestone(100)).toBe(100)
  })
  it('falls back to the next 100-multiple above known milestones', () => {
    expect(nextMilestone(2500)).toBe(2600)
  })
})
