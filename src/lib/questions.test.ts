import { describe, it, expect } from 'vitest'
import { QUESTIONS, pickTodayQuestion } from './questions'
import { STRIDE, gcd } from './dailyPick'

const days = (from: Date, n: number) =>
  Array.from({ length: n }, (_, i) => new Date(from.getFullYear(), from.getMonth(), from.getDate() + i))

describe('QUESTIONS', () => {
  it('has a year of different, non-empty questions', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(365)
    for (const q of QUESTIONS) expect(q.trim()).not.toBe('')
    expect(new Set(QUESTIONS).size).toBe(QUESTIONS.length)
    // Otherwise the daily jump would skip part of the list.
    expect(gcd(STRIDE, QUESTIONS.length)).toBe(1)
  })
})

describe('pickTodayQuestion', () => {
  it('gives the same question all day, from the list', () => {
    const q = pickTodayQuestion(new Date(2026, 9, 30, 0, 5))
    expect(pickTodayQuestion(new Date(2026, 9, 30, 23, 55))).toBe(q)
    expect(QUESTIONS).toContain(q)
  })

  it('does not repeat a question for a whole cycle, even across New Year', () => {
    const asked = days(new Date(2026, 9, 30), QUESTIONS.length).map((d) => pickTodayQuestion(d))
    expect(new Set(asked).size).toBe(QUESTIONS.length)
  })
})
