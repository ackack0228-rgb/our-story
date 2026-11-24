import { describe, it, expect } from 'vitest'
import { anniversaryNotification, answerDay, isRepeatAnswer, itemNotification, kstDate, subjectParticle } from './rules'

const names = { nameA: '갑', nameB: '을' }

describe('subjectParticle', () => {
  it('picks 이 after a final consonant and 가 after a vowel', () => {
    expect(subjectParticle('을')).toBe('이')
    expect(subjectParticle('갑')).toBe('이')
    expect(subjectParticle('민수')).toBe('가')
  })
  it('falls back for names that do not end in Hangul', () => {
    expect(subjectParticle('Tom')).toBe('이(가)')
    expect(subjectParticle('')).toBe('이(가)')
  })
})

describe('itemNotification', () => {
  it('tells the other person, naming the sender', () => {
    expect(itemNotification('notes', { text: '안녕', sender: 'B' }, names)).toEqual({ to: 'A', body: '을이 한마디를 남겼어요' })
    expect(itemNotification('doodles', { imageUrl: 'x.png', sender: 'A' }, names)).toEqual({ to: 'B', body: '갑이 낙서를 보냈어요' })
  })

  it('covers the four "more" collections with their own author field', () => {
    expect(itemNotification('bucket', { createdBy: 'A' }, names)?.body).toBe('갑이 버킷리스트를 추가했어요')
    expect(itemNotification('moods', { who: 'B', value: 7 }, names)).toEqual({ to: 'A', body: '을이 오늘의 감정을 기록했어요' })
    expect(itemNotification('archive', { createdBy: 'B' }, names)?.body).toBe('을이 후기를 남겼어요')
    expect(itemNotification('votes', { createdBy: 'A' }, names)?.body).toBe('갑이 여행지 후보를 올렸어요')
  })

  it('tells the other person when someone misses them', () => {
    expect(itemNotification('pokes', { sender: 'A' }, names)).toEqual({ to: 'B', body: '갑이 보고 싶대요 💗' })
    expect(itemNotification('pokes', { sender: 'B' }, names)).toEqual({ to: 'A', body: '을이 보고 싶대요 💗' })
  })

  it('announces a new calendar event with its date and title', () => {
    expect(itemNotification('events', { title: '저녁 약속', date: '2026-10-12', time: '19:00', owner: 'both', createdBy: 'B' }, names))
      .toEqual({ to: 'A', body: '을이 일정을 추가했어요: 10/12 저녁 약속' })
    expect(itemNotification('events', { title: '시험', date: '2027-01-03', owner: 'A', createdBy: 'A' }, names))
      .toEqual({ to: 'B', body: '갑이 일정을 추가했어요: 1/3 시험' })
  })

  it('names both ends of a multi-day event', () => {
    expect(itemNotification('events', { title: '여행', date: '2026-11-04', endDate: '2026-11-07', owner: 'both', createdBy: 'B' }, names))
      .toEqual({ to: 'A', body: '을이 일정을 추가했어요: 11/4~11/7 여행' })
    expect(itemNotification('events', { title: '약속', date: '2026-11-04', endDate: '', owner: 'A', createdBy: 'B' }, names))
      .toEqual({ to: 'A', body: '을이 일정을 추가했어요: 11/4 약속' })
  })

  it('sends an event to the other person whoever the event belongs to', () => {
    expect(itemNotification('events', { title: '휴가', date: '2026-10-12', owner: 'A', createdBy: 'B' }, names)?.to).toBe('A')
    expect(itemNotification('events', { title: '휴가', date: '2026-10-12', owner: 'B', createdBy: 'B' }, names)?.to).toBe('A')
  })

  it('falls back to a plain line when an event has no usable title or date', () => {
    const plain = { to: 'B', body: '갑이 일정을 추가했어요' }
    expect(itemNotification('events', { createdBy: 'A' }, names)).toEqual(plain)
    expect(itemNotification('events', { title: '   ', date: '2026-10-12', createdBy: 'A' }, names)).toEqual(plain)
    expect(itemNotification('events', { title: '약속', date: '내일', createdBy: 'A' }, names)).toEqual(plain)
    expect(itemNotification('events', { title: 7, date: 20261012, createdBy: 'A' }, names)).toEqual(plain)
  })

  it('cuts an overlong event title at 40 characters', () => {
    const body = itemNotification('events', { title: '가'.repeat(60), date: '2026-10-12', createdBy: 'A' }, names)!.body
    expect(body).toBe(`갑이 일정을 추가했어요: 10/12 ${'가'.repeat(40)}`)
  })

  it('stays quiet for an event with no recognisable author', () => {
    expect(itemNotification('events', { title: '약속', date: '2026-10-12', owner: 'A' }, names)).toBeNull()
  })

  it('announces an answer to the daily question without saying what it was', () => {
    const data = { date: '2026-10-08', question: '요즘 고마운 순간은?', text: '비밀 이야기', sender: 'B' }
    expect(itemNotification('answers', data, names)).toEqual({ to: 'A', body: '을이 오늘의 질문에 답했어요' })
    expect(itemNotification('answers', { ...data, sender: 'A' }, names)).toEqual({ to: 'B', body: '갑이 오늘의 질문에 답했어요' })
  })

  it('announces a balance game pick without saying which side', () => {
    const data = { date: '2026-10-14', who: 'B', pick: 'a', a: '바다 여행', b: '산 여행' }
    expect(itemNotification('balance', data, names)).toEqual({ to: 'A', body: '을이 밸런스 게임을 골랐어요' })
  })

  it('announces a reaction to a calendar event, naming the event and the reaction', () => {
    expect(itemNotification('reactions', { eventId: 'e1', emoji: 'heart', sender: 'B', eventTitle: '저녁 약속' }, names))
      .toEqual({ to: 'A', body: "을이 '저녁 약속'에 ❤️ 반응했어요" })
    expect(itemNotification('reactions', { eventId: 'e1', emoji: 'cheer', sender: 'A', eventTitle: '시험' }, names))
      .toEqual({ to: 'B', body: "갑이 '시험'에 💪 반응했어요" })
    expect(itemNotification('reactions', { eventId: 'e1', emoji: 'thumb', sender: 'A', eventTitle: '시험' }, names)!.body).toContain('👍')
  })

  it('tells the other person about a comment on a place record, without the comment itself', () => {
    const n = itemNotification('comments', { placeId: 'p1', placeName: '부산 광안리', text: '또 가자', sender: 'B' }, names)!
    expect(n.to).toBe('A')
    expect(n.body).toBe("을이 '부산 광안리' 기록에 댓글을 남겼어요")
    expect(n.body).not.toContain('또 가자')
    expect(itemNotification('comments', { placeId: 'p1', text: '응', sender: 'A' }, names)!.body).toBe('갑이 장소 기록에 댓글을 남겼어요')
  })

  it('falls back to a plain line when a reaction has no usable title or kind', () => {
    expect(itemNotification('reactions', { emoji: 'heart', sender: 'A' }, names)!.body).toBe('갑이 일정에 ❤️ 반응했어요')
    expect(itemNotification('reactions', { emoji: 'heart', sender: 'A', eventTitle: '   ' }, names)!.body).toBe('갑이 일정에 ❤️ 반응했어요')
    expect(itemNotification('reactions', { emoji: 'fire', sender: 'A', eventTitle: '시험' }, names)!.body).toBe("갑이 '시험'에 반응했어요")
    expect(itemNotification('reactions', { emoji: 'constructor', sender: 'A' }, names)!.body).toBe('갑이 일정에 반응했어요')
  })

  it('cuts an overlong event title in a reaction at 40 characters', () => {
    const body = itemNotification('reactions', { emoji: 'heart', sender: 'A', eventTitle: '가'.repeat(60) }, names)!.body
    expect(body).toBe(`갑이 '${'가'.repeat(40)}'에 ❤️ 반응했어요`)
  })

  it('never includes what was written', () => {
    expect(itemNotification('notes', { text: '비밀 이야기', sender: 'A' }, names)!.body).not.toContain('비밀')
  })

  it('stays quiet for places and unknown collections', () => {
    expect(itemNotification('places', { createdBy: 'A' }, names)).toBeNull()
    expect(itemNotification('hacks', { sender: 'A' }, names)).toBeNull()
  })

  it('stays quiet when the author is missing or not A/B', () => {
    expect(itemNotification('bucket', { text: '옛 항목' }, names)).toBeNull()
    expect(itemNotification('notes', { sender: 'C' }, names)).toBeNull()
    expect(itemNotification('notes', { sender: null }, names)).toBeNull()
    expect(itemNotification('notes', {}, names)).toBeNull()
  })

  it('reads the right field per collection', () => {
    expect(itemNotification('bucket', { sender: 'A' }, names)).toBeNull()
  })
})

describe('answerDay', () => {
  it('names the day and the sender to count', () => {
    expect(answerDay({ date: '2026-10-08', sender: 'B', text: '답' })).toEqual({ date: '2026-10-08', sender: 'B' })
  })
  it('is null when the row cannot be counted', () => {
    expect(answerDay({ sender: 'B' })).toBeNull()
    expect(answerDay({ date: '오늘', sender: 'B' })).toBeNull()
    expect(answerDay({ date: 20261008, sender: 'B' })).toBeNull()
    expect(answerDay({ date: '2026-10-08', sender: 'C' })).toBeNull()
    expect(answerDay({})).toBeNull()
  })
})

describe('isRepeatAnswer', () => {
  it('lets the first answer of the day through: nothing from that person came before it', () => {
    expect(isRepeatAnswer(0)).toBe(false)
  })
  it('stops an answer that has earlier ones before it', () => {
    expect(isRepeatAnswer(1)).toBe(true)
    expect(isRepeatAnswer(8)).toBe(true)
  })
  it('lets the notification through when the count is unknown', () => {
    expect(isRepeatAnswer(null)).toBe(false)
    expect(isRepeatAnswer(undefined)).toBe(false)
  })
})

describe('kstDate', () => {
  it('is the calendar date in Korea, nine hours ahead of UTC', () => {
    expect(kstDate(new Date('2026-10-06T14:59:59Z'))).toBe('2026-10-06')
    expect(kstDate(new Date('2026-10-06T15:00:00Z'))).toBe('2026-10-07')
    expect(kstDate(new Date('2026-12-31T23:00:00Z'))).toBe('2027-01-01')
  })
})

describe('anniversaryNotification', () => {
  const start = '2025-09-29'
  it('announces every hundredth day, counting the first day as D+0', () => {
    expect(anniversaryNotification(start, '2026-01-06')).toBeNull() // D+99
    expect(anniversaryNotification(start, '2026-01-07')).toBe('오늘은 D+100이에요 🎉')
    expect(anniversaryNotification(start, '2026-01-08')).toBeNull() // D+101
    expect(anniversaryNotification(start, '2026-11-03')).toBe('오늘은 D+400이에요 🎉')
  })

  it('announces yearly anniversaries', () => {
    expect(anniversaryNotification(start, '2026-09-29')).toBe('오늘은 1주년이에요 🎉')
    expect(anniversaryNotification(start, '2027-09-29')).toBe('오늘은 2주년이에요 🎉')
    expect(anniversaryNotification(start, '2026-09-30')).toBeNull() // D+366
  })

  it('says nothing on the first day, before it, or without a usable start date', () => {
    expect(anniversaryNotification(start, start)).toBeNull()
    expect(anniversaryNotification(start, '2025-09-01')).toBeNull()
    expect(anniversaryNotification(null, '2026-01-07')).toBeNull()
    expect(anniversaryNotification(undefined, '2026-01-07')).toBeNull()
    expect(anniversaryNotification('', '2026-01-07')).toBeNull()
    expect(anniversaryNotification('not-a-date', '2026-01-07')).toBeNull()
    expect(anniversaryNotification('2025-13-45', '2026-01-07')).toBeNull()
  })

  it('does not treat the same month and day in the starting year as an anniversary', () => {
    expect(anniversaryNotification('2026-10-06', '2026-10-06')).toBeNull()
  })
})
