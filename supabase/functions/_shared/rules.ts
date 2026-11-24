// Pure rules for notifications — no imports, so the same file runs in Deno (Edge Functions) and
// in Vitest. Who gets told what, and whether today is a day worth announcing.
export type Who = 'A' | 'B'

export interface Names {
  nameA: string
  nameB: string
}

type Data = Record<string, unknown>

// A new event is the one notification that says what was added: "10/12 저녁 약속".
function eventText(data: Data): string {
  const title = typeof data.title === 'string' ? data.title.trim().slice(0, 40) : ''
  const date = typeof data.date === 'string' ? /^\d{4}-(\d{2})-(\d{2})$/.exec(data.date) : null
  if (!title || !date) return '일정을 추가했어요'
  const end = typeof data.endDate === 'string' && data.endDate > (data.date as string)
    ? /^\d{4}-(\d{2})-(\d{2})$/.exec(data.endDate)
    : null
  const span = `${Number(date[1])}/${Number(date[2])}${end ? `~${Number(end[1])}/${Number(end[2])}` : ''}`
  return `일정을 추가했어요: ${span} ${title}`
}

// The reactions a calendar event can get, in the order the buttons show. The app reads this too.
export const REACTION_EMOJI = { heart: '❤️', thumb: '👍', cheer: '💪' } as const

// "'저녁 약속'에 ❤️ 반응했어요" — the event's title was saved with the reaction for this line.
function reactionText(data: Data): string {
  const title = typeof data.eventTitle === 'string' ? data.eventTitle.trim().slice(0, 40) : ''
  const kind = typeof data.emoji === 'string' && Object.prototype.hasOwnProperty.call(REACTION_EMOJI, data.emoji)
    ? `${REACTION_EMOJI[data.emoji as keyof typeof REACTION_EMOJI]} `
    : ''
  return `${title ? `'${title}'에` : '일정에'} ${kind}반응했어요`
}

// "'부산 광안리' 기록에 댓글을 남겼어요" — the comment itself stays out of the notification.
function commentText(data: Data): string {
  const name = typeof data.placeName === 'string' ? data.placeName.trim().slice(0, 40) : ''
  return `${name ? `'${name}' ` : '장소 '}기록에 댓글을 남겼어요`
}

// collection → which field names the author, and what they did.
const RULES: Record<string, { by: string; text: string | ((data: Data) => string) }> = {
  notes: { by: 'sender', text: '한마디를 남겼어요' },
  doodles: { by: 'sender', text: '낙서를 보냈어요' },
  bucket: { by: 'createdBy', text: '버킷리스트를 추가했어요' },
  moods: { by: 'who', text: '오늘의 감정을 기록했어요' },
  archive: { by: 'createdBy', text: '후기를 남겼어요' },
  votes: { by: 'createdBy', text: '여행지 후보를 올렸어요' },
  pokes: { by: 'sender', text: '보고 싶대요 💗' },
  events: { by: 'createdBy', text: eventText },
  answers: { by: 'sender', text: '오늘의 질문에 답했어요' },
  reactions: { by: 'sender', text: reactionText },
  balance: { by: 'who', text: '밸런스 게임을 골랐어요' },
  comments: { by: 'sender', text: commentText },
}

// 이/가 by whether the last syllable has a final consonant.
export function subjectParticle(name: string): string {
  const code = name.charCodeAt(name.length - 1)
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return '이(가)'
  return (code - 0xac00) % 28 === 0 ? '가' : '이'
}

// Returns null when nobody should be notified: places, unknown collections, and items with no
// recognisable author (records migrated from before createdBy existed).
export function itemNotification(
  collection: string,
  data: Record<string, unknown>,
  names: Names,
): { to: Who; body: string } | null {
  const rule = Object.prototype.hasOwnProperty.call(RULES, collection) ? RULES[collection] : undefined
  if (!rule) return null
  const author = data[rule.by]
  if (author !== 'A' && author !== 'B') return null
  const name = author === 'A' ? names.nameA : names.nameB
  const text = typeof rule.text === 'function' ? rule.text(data) : rule.text
  return { to: author === 'A' ? 'B' : 'A', body: `${name}${subjectParticle(name)} ${text}` }
}

// The daily question chat announces itself once per person per day. answerDay says which answers
// to count; isRepeatAnswer reads how many of them were written before the new one. Counting only
// earlier answers (not all of them) keeps the first one announced even when a second lands before
// the function has run.
export function answerDay(data: Data): { date: string; sender: Who } | null {
  const { date, sender } = data
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  if (sender !== 'A' && sender !== 'B') return null
  return { date, sender }
}

// An unknown count lets the notification through: one extra buzz beats a missed answer.
export function isRepeatAnswer(earlier: number | null | undefined): boolean {
  return typeof earlier === 'number' && earlier > 0
}

export function kstDate(now: Date): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function parseDate(iso: string): { y: number; m: number; d: number; utc: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const utc = Date.UTC(y, m - 1, d)
  const back = new Date(utc)
  // Rejects impossible dates like 2025-13-45, which Date.UTC would silently roll over.
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null
  return { y, m, d, utc }
}

// Same counting as the app's computeDday: the day we met is D+0, so the first anniversary is D+365.
export function anniversaryNotification(startDate: string | null | undefined, today: string): string | null {
  const start = startDate ? parseDate(startDate) : null
  const now = parseDate(today)
  if (!start || !now) return null
  const dday = Math.round((now.utc - start.utc) / 86400000)
  if (dday <= 0) return null
  const years = now.y - start.y
  if (years >= 1 && now.m === start.m && now.d === start.d) return `오늘은 ${years}주년이에요 🎉`
  return dday % 100 === 0 ? `오늘은 D+${dday}이에요 🎉` : null
}
