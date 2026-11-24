import { pad2 } from './isoDate'

export function todayLocalISODate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86400000)
}

// Days elapsed since the start date: the start date itself is D+0, so the first anniversary
// (same month/day a year later) lands on D+365.
export function computeDday(startDate: string, today: Date = new Date()): number {
  const start = new Date(startDate + 'T00:00:00')
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((todayMidnight.getTime() - startMidnight.getTime()) / 86400000)
}

const KNOWN_MILESTONES = [100, 200, 300, 365, 500, 700, 730, 1000, 2000]

export function nextMilestone(diff: number): number {
  const found = KNOWN_MILESTONES.find((m) => m >= diff)
  if (found !== undefined) return found
  return Math.ceil(diff / 100) * 100 + 100
}
