import { pickTodayQuestion } from './questions'
import { ISO_DATE, pad2 } from './isoDate'
import { subjectParticle, type Who } from '../../supabase/functions/_shared/rules'

export interface Answer {
  id: string
  date: string
  question: string
  text: string
  sender: Who
  createdAt: number
}

export const ANSWER_MAX = 300

const sentAt = (a: Answer) => (Number.isFinite(a.createdAt) ? a.createdAt : 0)

// Rows are free-form JSON. Anything without a usable date, text or sender is left out of the chat
// rather than breaking it.
export function isAnswer(v: unknown): v is Answer {
  const a = v as Partial<Answer> | null
  return !!a && typeof a.text === 'string' && a.text.trim() !== '' && typeof a.date === 'string' && ISO_DATE.test(a.date)
    && (a.sender === 'A' || a.sender === 'B')
}

// One day's chat, oldest first.
export function answersOn(answers: Answer[], date: string): Answer[] {
  return answers.filter((a) => a.date === date).sort((a, b) => sentAt(a) - sentAt(b))
}

function whoAnswered(answers: Answer[], date: string, me: Who): { mine: boolean; theirs: boolean } {
  const day = answers.filter((a) => a.date === date)
  return { mine: day.some((a) => a.sender === me), theirs: day.some((a) => a.sender !== me) }
}

// Today the other person's answers stay hidden until I have sent one of my own. Past days are open.
export function isLocked(answers: Answer[], date: string, me: Who, today: string): boolean {
  if (date !== today) return false
  const { mine, theirs } = whoAnswered(answers, date, me)
  return theirs && !mine
}

// The line under the question on the home card.
export function cardStatus(answers: Answer[], today: string, me: Who, partnerName: string): string {
  const { mine, theirs } = whoAnswered(answers, today, me)
  if (mine && theirs) return '둘 다 답했어요 💬'
  if (theirs) return `${partnerName}${subjectParticle(partnerName)} 답했어요 · 답하면 볼 수 있어요`
  if (mine) return `${partnerName}의 답을 기다리는 중`
  return '눌러서 답하기'
}

// The days ‹ › can reach: every earlier day with a conversation, then today. Days after today (a phone
// whose clock is ahead) are left out so today is always the last stop.
export function chatDates(answers: Answer[], today: string): string[] {
  const earlier = new Set(answers.map((a) => a.date).filter((d) => d < today))
  return [...earlier].sort().concat(today)
}

// The question saved with that day's answers, so old chats keep their question if the list changes.
export function questionFor(answers: Answer[], date: string): string {
  const saved = answersOn(answers, date).find((a) => typeof a.question === 'string' && a.question.trim() !== '')
  if (saved) return saved.question
  const [y, m, d] = date.split('-').map(Number)
  return pickTodayQuestion(new Date(y, m - 1, d))
}

// 'HH:MM' in local time, or '' when the row has no usable time.
export function timeLabel(createdAt: number): string {
  if (!Number.isFinite(createdAt)) return ''
  const d = new Date(createdAt)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
