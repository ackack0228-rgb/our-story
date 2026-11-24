import { describe, it, expect } from 'vitest'
import { BALANCE_QUESTIONS, choicesOn, gameOn, gameStatus, isBalancePick, pastGames, type BalancePick } from './balance'

let n = 0
const pick = (date: string, who: 'A' | 'B', side: 'a' | 'b', over: Partial<BalancePick> = {}): BalancePick =>
  ({ id: `p${n++}`, date, who, pick: side, a: '바다', b: '산', createdAt: 1, ...over })

describe('BALANCE_QUESTIONS', () => {
  it('has two different, non-empty choices in every question, and no question twice', () => {
    for (const [a, b] of BALANCE_QUESTIONS) {
      expect(a.trim()).not.toBe('')
      expect(b.trim()).not.toBe('')
      expect(a).not.toBe(b)
    }
    expect(new Set(BALANCE_QUESTIONS.map((q) => q.join('|'))).size).toBe(BALANCE_QUESTIONS.length)
  })

  it('has a year of questions, none coming back within the year', () => {
    expect(BALANCE_QUESTIONS.length).toBeGreaterThanOrEqual(365)
    const dates = Array.from({ length: BALANCE_QUESTIONS.length }, (_, i) => {
      const d = new Date(2026, 9, 30 + i)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
    const seen = dates.map((date) => { const c = choicesOn([], date); return `${c.a}|${c.b}` })
    expect(new Set(seen).size).toBe(BALANCE_QUESTIONS.length)
  })
})

describe('isBalancePick', () => {
  it('accepts a full pick and rejects broken rows', () => {
    expect(isBalancePick(pick('2026-10-14', 'A', 'a'))).toBe(true)
    expect(isBalancePick(null)).toBe(false)
    expect(isBalancePick({ date: '2026-10-14', who: 'A', pick: 'c' })).toBe(false)
    expect(isBalancePick({ date: 'today', who: 'A', pick: 'a' })).toBe(false)
    expect(isBalancePick({ date: '2026-10-14', who: 'C', pick: 'a' })).toBe(false)
  })
})

describe('choicesOn', () => {
  it('uses the choices saved with that day\'s picks', () => {
    expect(choicesOn([pick('2026-10-14', 'B', 'a', { a: '옛 질문', b: '옛 답' })], '2026-10-14')).toEqual({ a: '옛 질문', b: '옛 답' })
  })

  it('falls back to the list, the same for both phones and different the next day', () => {
    const today = choicesOn([], '2026-10-14')
    expect(choicesOn([], '2026-10-14')).toEqual(today)
    expect(BALANCE_QUESTIONS).toContainEqual([today.a, today.b])
    expect(choicesOn([], '2026-10-15')).not.toEqual(today)
  })
})

describe('gameOn and gameStatus', () => {
  const day = '2026-10-14'

  it('starts with nothing picked', () => {
    const state = gameOn([], day, 'A')
    expect(state).toEqual({ mine: null, theirs: null, open: false, matched: false })
    expect(gameStatus(state, '을')).toBe('하나를 골라 보세요')
  })

  it('stays closed while only the other person has picked', () => {
    const state = gameOn([pick(day, 'B', 'b')], day, 'A')
    expect(state.open).toBe(false)
    expect(gameStatus(state, '을')).toBe('을이 골랐어요 · 고르면 볼 수 있어요')
  })

  it('waits for the other person after my pick', () => {
    const state = gameOn([pick(day, 'A', 'a')], day, 'A')
    expect(state.mine).toBe('a')
    expect(gameStatus(state, '을')).toBe('을의 선택을 기다리는 중')
  })

  it('opens when both have picked', () => {
    const same = gameOn([pick(day, 'A', 'a'), pick(day, 'B', 'a')], day, 'A')
    expect(same).toMatchObject({ open: true, matched: true })
    expect(gameStatus(same, '을')).toBe('통했어요! 🎉')
    const differ = gameOn([pick(day, 'A', 'a'), pick(day, 'B', 'b')], day, 'B')
    expect(differ).toMatchObject({ mine: 'b', theirs: 'a', open: true, matched: false })
    expect(gameStatus(differ, '갑')).toBe('이번엔 달랐어요 😆')
  })

  it('ignores other days', () => {
    expect(gameOn([pick('2026-10-13', 'A', 'a')], day, 'A').mine).toBeNull()
  })
})

describe('pastGames', () => {
  it('lists earlier days both picked, newest first', () => {
    const games = pastGames([
      pick('2026-10-12', 'A', 'a'), pick('2026-10-12', 'B', 'a'),
      pick('2026-10-13', 'A', 'a'), pick('2026-10-13', 'B', 'b', { a: '찍먹', b: '부먹' }),
      pick('2026-10-11', 'A', 'a'),
      pick('2026-10-14', 'A', 'a'), pick('2026-10-14', 'B', 'a'),
    ], '2026-10-14')
    expect(games.map((g) => [g.date, g.matched])).toEqual([['2026-10-13', false], ['2026-10-12', true]])
    expect(games[0].picks).toEqual({ A: 'a', B: 'b' })
  })
})
