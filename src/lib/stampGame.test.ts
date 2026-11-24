import { describe, it, expect } from 'vitest'
import { drop, widthAfterPerfect, speedFor, colorFor, isGameRecord, bestOf, START_W, STAMP_COLORS, type GameRecord } from './stampGame'

describe('drop', () => {
  const below = { x: 100, w: 120 }

  it('counts a landing within a few units as perfect and keeps the whole stamp, lined up', () => {
    expect(drop(below, { x: 103, w: 120 })).toEqual({ kind: 'perfect', placed: { x: 100, w: 120 } })
    expect(drop(below, { x: 96, w: 120 })).toEqual({ kind: 'perfect', placed: { x: 100, w: 120 } })
  })

  it('cuts off what hangs past the right edge', () => {
    expect(drop(below, { x: 130, w: 120 })).toEqual({ kind: 'cut', placed: { x: 130, w: 90 }, debris: { x: 220, w: 30 } })
  })

  it('cuts off what hangs past the left edge', () => {
    expect(drop(below, { x: 60, w: 120 })).toEqual({ kind: 'cut', placed: { x: 100, w: 80 }, debris: { x: 60, w: 40 } })
  })

  it('ends the game when the stamp misses entirely', () => {
    expect(drop(below, { x: 220, w: 120 })).toEqual({ kind: 'miss' })
    expect(drop(below, { x: -30, w: 120 })).toEqual({ kind: 'miss' })
  })
})

describe('widthAfterPerfect', () => {
  it('grows back every third perfect drop in a row, never past the start width', () => {
    expect(widthAfterPerfect(100, 1)).toBe(100)
    expect(widthAfterPerfect(100, 3)).toBe(110)
    expect(widthAfterPerfect(START_W - 2, 6)).toBe(START_W)
  })
})

describe('speedFor', () => {
  it('speeds up with each floor up to a ceiling', () => {
    expect(speedFor(1)).toBeGreaterThan(speedFor(0))
    expect(speedFor(1000)).toBe(speedFor(2000))
  })
})

describe('colorFor', () => {
  it('cycles through the palette', () => {
    expect(colorFor(0)).toBe(STAMP_COLORS[0])
    expect(colorFor(STAMP_COLORS.length)).toBe(STAMP_COLORS[0])
  })
})

describe('records', () => {
  const rec = (who: 'A' | 'B', best: number): GameRecord => ({ id: `stack_${who}`, game: 'stack', who, best, createdAt: 1 })

  it('accepts a full record and rejects broken rows', () => {
    expect(isGameRecord(rec('A', 3))).toBe(true)
    expect(isGameRecord(null)).toBe(false)
    expect(isGameRecord({ game: 'stack', who: 'C', best: 3 })).toBe(false)
    expect(isGameRecord({ game: 'stack', who: 'A', best: -1 })).toBe(false)
    expect(isGameRecord({ game: 'other', who: 'A', best: 3 })).toBe(false)
  })

  it('reads each person\'s best, 0 when they have not played', () => {
    expect(bestOf([rec('A', 7), rec('B', 4)], 'B')).toBe(4)
    expect(bestOf([rec('A', 7)], 'B')).toBe(0)
  })
})
