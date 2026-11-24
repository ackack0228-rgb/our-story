import { describe, it, expect } from 'vitest'
import { mergeFeed } from './feedMerge'

describe('mergeFeed', () => {
  it('merges doodles and notes into one list sorted newest-first', () => {
    const doodles = [{ id: 'd1', imageUrl: 'x', sender: 'A', createdAt: 100 }]
    const notes = [
      { id: 'n1', text: 'hi', sender: 'B', createdAt: 300 },
      { id: 'n2', text: 'old', sender: 'B', createdAt: 50 },
    ]
    const result = mergeFeed(doodles, notes)
    expect(result.map((r) => r.id)).toEqual(['n1', 'd1', 'n2'])
    expect(result[0].type).toBe('note')
    expect(result[1].type).toBe('doodle')
  })
})
