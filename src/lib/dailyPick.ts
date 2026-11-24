// Picks "today's" item from a list so that every item comes up once before any comes up again,
// and neighbouring days land far apart in the list (lists are written grouped by theme).
// Counts days from 1970-01-01 rather than the day of the year, so New Year does not restart the cycle.
// Kept apart from date.ts because many tests mock that module whole.

/** Jump between days. Must share no factor with a list's length, or some items would never come up. */
export const STRIDE = 97

export function dayNumber(d: Date): number {
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000)
}

export function pickForDay<T>(list: readonly T[], d: Date): T {
  return list[(dayNumber(d) * STRIDE) % list.length]
}

export function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}
