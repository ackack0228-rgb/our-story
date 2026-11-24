import { describe, it, expect } from 'vitest'
import { REACTION_KEYS, isReaction, reactionId, reactionSummary, reactionsFor, type Reaction } from './reactions'

function r(over: Partial<Reaction>): Reaction {
  return { id: 'r', eventId: 'e1', emoji: 'heart', sender: 'A', eventTitle: '약속', createdAt: 1, ...over }
}

describe('isReaction', () => {
  it('accepts a known reaction on an event from A or B', () => {
    expect(isReaction(r({}))).toBe(true)
  })
  it('rejects rows that would break the calendar', () => {
    expect(isReaction(null)).toBe(false)
    expect(isReaction({ ...r({}), eventId: '' })).toBe(false)
    expect(isReaction({ ...r({}), eventId: 7 })).toBe(false)
    expect(isReaction({ ...r({}), emoji: 'fire' })).toBe(false)
    expect(isReaction({ ...r({}), emoji: 'toString' })).toBe(false)
    expect(isReaction({ ...r({}), sender: 'C' })).toBe(false)
  })
})

describe('reactionId', () => {
  it('is one id per event, person and kind, so the same reaction cannot be saved twice', () => {
    expect(reactionId('e1', 'B', 'cheer')).toBe('e1_B_cheer')
  })
})

describe('reactionsFor', () => {
  it('always lists heart, thumb, cheer in that order, with who pressed each', () => {
    const list = [
      r({ id: '1', emoji: 'cheer', sender: 'B' }),
      r({ id: '2', emoji: 'heart', sender: 'B' }),
      r({ id: '3', emoji: 'heart', sender: 'A' }),
      r({ id: '4', eventId: 'other', emoji: 'thumb', sender: 'A' }),
    ]
    expect(reactionsFor(list, 'e1')).toEqual([
      { key: 'heart', emoji: '❤️', who: ['A', 'B'] },
      { key: 'thumb', emoji: '👍', who: [] },
      { key: 'cheer', emoji: '💪', who: ['B'] },
    ])
    expect(REACTION_KEYS).toEqual(['heart', 'thumb', 'cheer'])
  })
  it('counts a person once even if a duplicate row slipped in', () => {
    expect(reactionsFor([r({ id: '1' }), r({ id: '2' })], 'e1')[0].who).toEqual(['A'])
  })
})

describe('reactionSummary', () => {
  it('is the emojis that anyone pressed, in order', () => {
    expect(reactionSummary([r({ emoji: 'cheer' }), r({ id: '2', emoji: 'heart', sender: 'B' })], 'e1')).toBe('❤️💪')
  })
  it('is empty when the event has none', () => {
    expect(reactionSummary([r({ eventId: 'other' })], 'e1')).toBe('')
  })
})
