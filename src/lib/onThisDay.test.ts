import { describe, it, expect } from 'vitest'
import { onThisDay } from './onThisDay'
import type { Place } from './places'

function place(id: string, date: unknown): Place {
  return {
    id, name: id, date: date as string, mood: '🌊', diary: '', x: 0, y: 0,
    photoUrl: null, createdBy: 'A', createdAt: 1,
  }
}

describe('onThisDay', () => {
  it('matches the same month/day one, two and three years earlier', () => {
    const result = onThisDay(
      [place('a', '2025-10-06'), place('b', '2024-10-06'), place('c', '2023-10-06')],
      '2026-10-06',
    )
    expect(result.map((m) => [m.place.id, m.yearsAgo])).toEqual([['a', 1], ['b', 2], ['c', 3]])
  })

  it('excludes today itself and future years', () => {
    expect(onThisDay([place('a', '2026-10-06'), place('b', '2027-10-06')], '2026-10-06')).toEqual([])
  })

  it('excludes a different day or month', () => {
    expect(onThisDay([place('a', '2025-10-07'), place('b', '2025-11-06')], '2026-10-06')).toEqual([])
  })

  it('orders most recent first and keeps input order within the same year', () => {
    const result = onThisDay(
      [place('old', '2023-10-06'), place('x', '2025-10-06'), place('mid', '2024-10-06'), place('y', '2025-10-06')],
      '2026-10-06',
    )
    expect(result.map((m) => m.place.id)).toEqual(['x', 'y', 'mid', 'old'])
  })

  it('skips places with a missing, empty or malformed date without throwing', () => {
    const bad = [place('a', undefined), place('b', ''), place('c', '2025/10/06'), place('d', 'garbage'), place('e', null)]
    expect(onThisDay(bad, '2026-10-06')).toEqual([])
  })

  it('returns an empty list for a malformed today', () => {
    expect(onThisDay([place('a', '2025-10-06')], 'nope')).toEqual([])
    expect(onThisDay([place('a', '2025-10-06')], '')).toEqual([])
  })

  it('matches Feb 29 only when today is Feb 29', () => {
    const p = [place('leap', '2024-02-29')]
    expect(onThisDay(p, '2025-02-28')).toEqual([])
    expect(onThisDay(p, '2025-03-01')).toEqual([])
    expect(onThisDay(p, '2028-02-29').map((m) => m.yearsAgo)).toEqual([4])
  })

  it('compares strings without timezone conversion (Jan 1)', () => {
    expect(onThisDay([place('a', '2025-01-01')], '2026-01-01').map((m) => m.yearsAgo)).toEqual([1])
  })
})
