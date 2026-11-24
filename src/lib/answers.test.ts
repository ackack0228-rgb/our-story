import { describe, it, expect, vi } from 'vitest'
import { ANSWER_MAX, answersOn, cardStatus, chatDates, isAnswer, isLocked, questionFor, timeLabel, type Answer } from './answers'

vi.mock('./questions', () => ({ pickTodayQuestion: (d: Date) => `질문 ${d.getMonth() + 1}/${d.getDate()}` }))

const TODAY = '2026-10-08'

function ans(over: Partial<Answer>): Answer {
  return { id: 'a', date: TODAY, question: '저장된 질문', text: '답', sender: 'A', createdAt: 1, ...over }
}

describe('isAnswer', () => {
  it('accepts a row with a date, some text and a sender', () => {
    expect(isAnswer(ans({}))).toBe(true)
  })
  it('rejects rows that would break the chat', () => {
    expect(isAnswer(null)).toBe(false)
    expect(isAnswer({ text: '답', sender: 'A' })).toBe(false)
    expect(isAnswer(ans({ date: '어제' }))).toBe(false)
    expect(isAnswer(ans({ text: '   ' }))).toBe(false)
    expect(isAnswer({ ...ans({}), text: 7 })).toBe(false)
    expect(isAnswer({ ...ans({}), sender: 'C' })).toBe(false)
  })
  it('caps an answer at 300 characters', () => {
    expect(ANSWER_MAX).toBe(300)
  })
})

describe('answersOn', () => {
  it('keeps only that day, oldest first', () => {
    const list = [ans({ id: 'late', createdAt: 30 }), ans({ id: 'other', date: '2026-10-07' }), ans({ id: 'early', createdAt: 10 })]
    expect(answersOn(list, TODAY).map((a) => a.id)).toEqual(['early', 'late'])
  })
  it('does not scramble the order when a row has no usable createdAt', () => {
    const broken = { ...ans({ id: 'broken' }), createdAt: undefined as unknown as number }
    const list = [ans({ id: 'b', createdAt: 20 }), broken, ans({ id: 'a', createdAt: 10 })]
    expect(answersOn(list, TODAY).map((a) => a.id)).toEqual(['broken', 'a', 'b'])
  })
})

describe('isLocked', () => {
  it('hides the other answer today until I have answered', () => {
    expect(isLocked([ans({ sender: 'B' })], TODAY, 'A', TODAY)).toBe(true)
  })
  it('opens once I have answered', () => {
    expect(isLocked([ans({ sender: 'B' }), ans({ id: 'mine', sender: 'A' })], TODAY, 'A', TODAY)).toBe(false)
  })
  it('has nothing to hide when nobody, or only I, answered', () => {
    expect(isLocked([], TODAY, 'A', TODAY)).toBe(false)
    expect(isLocked([ans({ sender: 'A' })], TODAY, 'A', TODAY)).toBe(false)
  })
  it('never hides a past day', () => {
    expect(isLocked([ans({ sender: 'B', date: '2026-10-07' })], '2026-10-07', 'A', TODAY)).toBe(false)
  })
  it('ignores my answers from other days', () => {
    expect(isLocked([ans({ sender: 'B' }), ans({ id: 'old', sender: 'A', date: '2026-10-07' })], TODAY, 'A', TODAY)).toBe(true)
  })
})

describe('cardStatus', () => {
  it('invites an answer when nobody has written today', () => {
    expect(cardStatus([ans({ date: '2026-10-07' })], TODAY, 'A', '을')).toBe('눌러서 답하기')
  })
  it('says the other person answered, without showing it', () => {
    expect(cardStatus([ans({ sender: 'B' })], TODAY, 'A', '을')).toBe('을이 답했어요 · 답하면 볼 수 있어요')
    expect(cardStatus([ans({ sender: 'B' })], TODAY, 'A', '민수')).toBe('민수가 답했어요 · 답하면 볼 수 있어요')
  })
  it('says I am waiting when only I answered', () => {
    expect(cardStatus([ans({ sender: 'A' })], TODAY, 'A', '을')).toBe('을의 답을 기다리는 중')
  })
  it('says both answered', () => {
    expect(cardStatus([ans({ sender: 'A' }), ans({ id: 'b', sender: 'B' })], TODAY, 'A', '을')).toBe('둘 다 답했어요 💬')
  })
})

describe('chatDates', () => {
  it('lists the days that have a conversation, oldest first, ending on today', () => {
    const list = [ans({ date: '2026-10-05' }), ans({ date: '2026-10-01' }), ans({ date: '2026-10-05' }), ans({})]
    expect(chatDates(list, TODAY)).toEqual(['2026-10-01', '2026-10-05', TODAY])
  })
  it('includes today even with no answers at all', () => {
    expect(chatDates([], TODAY)).toEqual([TODAY])
  })
  it('leaves out days after today, from a phone whose clock is ahead', () => {
    expect(chatDates([ans({ date: '2026-10-09' }), ans({ date: '2026-10-07' })], TODAY)).toEqual(['2026-10-07', TODAY])
  })
})

describe('questionFor', () => {
  it('uses the question saved with that day', () => {
    expect(questionFor([ans({ date: '2026-10-07', question: '그날의 질문' })], '2026-10-07')).toBe('그날의 질문')
  })
  it('falls back to the question the list gives for that date', () => {
    expect(questionFor([], TODAY)).toBe('질문 10/8')
    expect(questionFor([ans({ date: '2026-10-07', question: '  ' })], '2026-10-07')).toBe('질문 10/7')
  })
})

describe('timeLabel', () => {
  it('is the local time as HH:MM', () => {
    expect(timeLabel(new Date(2026, 9, 8, 9, 5).getTime())).toBe('09:05')
    expect(timeLabel(new Date(2026, 9, 8, 23, 40).getTime())).toBe('23:40')
  })
  it('is empty when there is no usable time', () => {
    expect(timeLabel(undefined as unknown as number)).toBe('')
    expect(timeLabel(NaN)).toBe('')
  })
})
