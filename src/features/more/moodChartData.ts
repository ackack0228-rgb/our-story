import type { MoodLog } from '../../lib/moodLogs'

export interface MoodChartPoint {
  date: string
  a: number | null
  b: number | null
}

export function buildMoodChartData(logs: MoodLog[], members: [string, string]): MoodChartPoint[] {
  const dates = [...new Set(logs.map((l) => l.date))].sort().slice(-14)
  return dates.map((date) => {
    const a = logs.find((l) => l.date === date && l.who === members[0])
    const b = logs.find((l) => l.date === date && l.who === members[1])
    return { date, a: a ? a.value : null, b: b ? b.value : null }
  })
}
