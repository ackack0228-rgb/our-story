import { pickForDay } from './dailyPick'
import { BALANCE_QUESTIONS } from './balanceQuestions'
import { ISO_DATE } from './isoDate'
import { subjectParticle, type Who } from '../../supabase/functions/_shared/rules'

export type Side = 'a' | 'b'

export interface BalancePick {
  id: string
  date: string
  who: Who
  pick: Side
  /** The two choices as they read that day, so old games keep theirs if the list changes. */
  a: string
  b: string
  createdAt: number
}

export { BALANCE_QUESTIONS }

// Rows are free-form JSON. Anything without a usable date, person or pick is left out of the game.
export function isBalancePick(v: unknown): v is BalancePick {
  const p = v as Partial<BalancePick> | null
  return !!p && typeof p.date === 'string' && ISO_DATE.test(p.date) && (p.who === 'A' || p.who === 'B')
    && (p.pick === 'a' || p.pick === 'b')
}

/** The two choices of a day: the ones saved with that day's picks, else the list's for that date. */
export function choicesOn(picks: BalancePick[], date: string): { a: string; b: string } {
  const saved = picks.find((p) => p.date === date && typeof p.a === 'string' && p.a.trim() !== '' && typeof p.b === 'string' && p.b.trim() !== '')
  if (saved) return { a: saved.a, b: saved.b }
  const [y, m, d] = date.split('-').map(Number)
  const [a, b] = pickForDay(BALANCE_QUESTIONS, new Date(y, m - 1, d))
  return { a, b }
}

export interface GameState {
  mine: Side | null
  /** The other person's pick — the screen shows it only once `open` is true. */
  theirs: Side | null
  /** Both have picked: the result can be shown. */
  open: boolean
  matched: boolean
}

export function gameOn(picks: BalancePick[], date: string, me: Who): GameState {
  const day = picks.filter((p) => p.date === date)
  const mine = day.find((p) => p.who === me)?.pick ?? null
  const theirs = day.find((p) => p.who !== me)?.pick ?? null
  const open = mine !== null && theirs !== null
  return { mine, theirs, open, matched: open && mine === theirs }
}

// The line under the two buttons.
export function gameStatus(state: GameState, partnerName: string): string {
  if (state.open) return state.matched ? '통했어요! 🎉' : '이번엔 달랐어요 😆'
  if (state.mine) return `${partnerName}의 선택을 기다리는 중`
  if (state.theirs) return `${partnerName}${subjectParticle(partnerName)} 골랐어요 · 고르면 볼 수 있어요`
  return '하나를 골라 보세요'
}

export interface PastGame {
  date: string
  a: string
  b: string
  picks: Record<Who, Side>
  matched: boolean
}

/** Earlier days both of us picked, newest first. */
export function pastGames(picks: BalancePick[], today: string): PastGame[] {
  const dates = [...new Set(picks.map((p) => p.date).filter((d) => d < today))].sort().reverse()
  const games: PastGame[] = []
  for (const date of dates) {
    const a = picks.find((p) => p.date === date && p.who === 'A')
    const b = picks.find((p) => p.date === date && p.who === 'B')
    if (!a || !b) continue
    games.push({ date, ...choicesOn(picks, date), picks: { A: a.pick, B: b.pick }, matched: a.pick === b.pick })
  }
  return games
}
