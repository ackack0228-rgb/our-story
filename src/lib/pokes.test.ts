import { describe, it, expect } from 'vitest'
import { latestPokeFrom, formatAgo, POKE_VISIBLE_MS, type Poke } from './pokes'

const NOW = 1_800_000_000_000
const poke = (id: string, sender: 'A' | 'B', createdAt: number): Poke => ({ id, sender, createdAt })

describe('latestPokeFrom', () => {
  it('picks the newest of several', () => {
    const pokes = [poke('1', 'B', NOW - 3000), poke('2', 'B', NOW - 1000), poke('3', 'B', NOW - 2000)]
    expect(latestPokeFrom(pokes, 'B', NOW)?.id).toBe('2')
  })

  it('ignores the other sender', () => {
    const pokes = [poke('1', 'A', NOW - 1000), poke('2', 'B', NOW - 5000)]
    expect(latestPokeFrom(pokes, 'B', NOW)?.id).toBe('2')
    expect(latestPokeFrom([poke('1', 'A', NOW - 1000)], 'B', NOW)).toBeNull()
  })

  it('ignores pokes 24 hours old or older', () => {
    expect(latestPokeFrom([poke('1', 'B', NOW - POKE_VISIBLE_MS)], 'B', NOW)).toBeNull()
    expect(latestPokeFrom([poke('1', 'B', NOW - POKE_VISIBLE_MS + 1)], 'B', NOW)?.id).toBe('1')
  })

  it('returns null for an empty list', () => {
    expect(latestPokeFrom([], 'B', NOW)).toBeNull()
  })

  it('still returns a poke dated in the future (clock skew)', () => {
    const future = poke('1', 'B', NOW + 5000)
    expect(latestPokeFrom([future], 'B', NOW)).toBe(future)
    expect(formatAgo(NOW - future.createdAt)).toBe('방금 전')
  })
})

describe('formatAgo', () => {
  const MIN = 60_000
  it('says 방금 전 under a minute', () => {
    expect(formatAgo(0)).toBe('방금 전')
    expect(formatAgo(59_999)).toBe('방금 전')
  })
  it('counts minutes under an hour', () => {
    expect(formatAgo(MIN)).toBe('1분 전')
    expect(formatAgo(59 * MIN + 59_000)).toBe('59분 전')
  })
  it('counts whole hours after that', () => {
    expect(formatAgo(60 * MIN)).toBe('1시간 전')
    expect(formatAgo(23 * 60 * MIN + 59 * MIN)).toBe('23시간 전')
  })
})
