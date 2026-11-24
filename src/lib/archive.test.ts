import { describe, it, expect } from 'vitest'
import { reviewTypeFor } from './archive'

describe('reviewTypeFor', () => {
  it('sends 맛집, 영화 and 여행지 to their 후기 kind', () => {
    expect(reviewTypeFor('food')).toBe('food')
    expect(reviewTypeFor('movie')).toBe('movie')
    expect(reviewTypeFor('destination')).toBe('travel')
  })

  it('has no 후기 for 도전과제 or an unknown kind', () => {
    expect(reviewTypeFor('challenge')).toBeNull()
    expect(reviewTypeFor('whatever')).toBeNull()
    expect(reviewTypeFor('toString')).toBeNull()
  })
})
