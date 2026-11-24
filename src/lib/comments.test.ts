import { describe, it, expect } from 'vitest'
import { commentTime, commentsFor, isComment, type PlaceComment } from './comments'

const c = (id: string, placeId: string, createdAt: number): PlaceComment => ({ id, placeId, text: '좋았지', sender: 'A', createdAt })

describe('isComment', () => {
  it('accepts a full comment and rejects broken rows', () => {
    expect(isComment(c('1', 'p1', 1))).toBe(true)
    expect(isComment(null)).toBe(false)
    expect(isComment({ placeId: 'p1', text: '  ', sender: 'A' })).toBe(false)
    expect(isComment({ placeId: '', text: '응', sender: 'A' })).toBe(false)
    expect(isComment({ placeId: 'p1', text: '응', sender: 'C' })).toBe(false)
  })
})

describe('commentsFor', () => {
  it('gives one place\'s comments, oldest first', () => {
    const all = [c('3', 'p1', 30), c('1', 'p1', 10), c('2', 'p2', 20)]
    expect(commentsFor(all, 'p1').map((x) => x.id)).toEqual(['1', '3'])
  })
})

describe('commentTime', () => {
  it('reads month/day and time in local time', () => {
    expect(commentTime(new Date(2026, 9, 30, 9, 5).getTime())).toBe('10/30 09:05')
    expect(commentTime(Number.NaN)).toBe('')
  })
})
