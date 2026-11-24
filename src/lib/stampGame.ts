// 우표 쌓기 — the rules, apart from the drawing so they can be tested.
// A stamp slides side to side above the stack; a tap drops it. The part hanging past the stamp
// below is cut off, so the next stamp is only as wide as the overlap. Missing entirely ends the game.
import type { Who } from '../../supabase/functions/_shared/rules'

/** Board width every position below is measured in; the screen scales it to fit. */
export const BOARD_W = 320
export const STAMP_H = 30
export const START_W = 180
/** Landing this close to the stamp below counts as a perfect drop: nothing is cut. */
export const PERFECT_PX = 4
/** After this many perfect drops in a row the stamp grows back a little. */
export const COMBO_GROW = 3
export const GROW_PX = 10

export interface Span { x: number; w: number }

export type DropResult =
  | { kind: 'miss' }
  | { kind: 'perfect'; placed: Span }
  | { kind: 'cut'; placed: Span; debris: Span }

export function drop(below: Span, moving: Span): DropResult {
  if (Math.abs(moving.x - below.x) <= PERFECT_PX) return { kind: 'perfect', placed: { x: below.x, w: moving.w } }
  const left = Math.max(below.x, moving.x)
  const right = Math.min(below.x + below.w, moving.x + moving.w)
  if (right <= left) return { kind: 'miss' }
  const placed = { x: left, w: right - left }
  const debris = moving.x < below.x
    ? { x: moving.x, w: below.x - moving.x }
    : { x: right, w: moving.x + moving.w - right }
  return { kind: 'cut', placed, debris }
}

/** Width of the next stamp after a perfect drop — grows back every few in a row, never past the start. */
export function widthAfterPerfect(w: number, combo: number): number {
  return combo > 0 && combo % COMBO_GROW === 0 ? Math.min(START_W, w + GROW_PX) : w
}

/** Board units per second: a little faster with every floor, up to a ceiling. */
export function speedFor(floors: number): number {
  return Math.min(140 + floors * 9, 380)
}

// The palette the stamps cycle through, bottom to top.
export const STAMP_COLORS = ['#E8959C', '#D9A87E', '#FBF1EA', '#C4707E', '#B98BC9', '#F0DCCD']
export function colorFor(floor: number): string {
  return STAMP_COLORS[floor % STAMP_COLORS.length]
}

// Best scores: one row per person, id `stack_${who}`, written only when the record is beaten.
export interface GameRecord { id: string; game: 'stack'; who: Who; best: number; createdAt: number }

export function isGameRecord(v: unknown): v is GameRecord {
  const r = v as Partial<GameRecord> | null
  return !!r && r.game === 'stack' && (r.who === 'A' || r.who === 'B')
    && typeof r.best === 'number' && Number.isFinite(r.best) && r.best >= 0
}

export function bestOf(records: GameRecord[], who: Who): number {
  return records.filter((r) => r.who === who).reduce((m, r) => Math.max(m, r.best), 0)
}
