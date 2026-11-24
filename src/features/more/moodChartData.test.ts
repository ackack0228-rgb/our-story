import { describe, it, expect } from 'vitest'
import { buildMoodChartData } from './moodChartData'

describe('buildMoodChartData', () => {
  it('pairs each distinct date with both members values, null when missing', () => {
    const logs = [
      { id: '1A', date: '2026-01-01', value: 5, who: 'A', createdAt: 1 },
      { id: '1B', date: '2026-01-01', value: 8, who: 'B', createdAt: 1 },
      { id: '2A', date: '2026-01-02', value: 3, who: 'A', createdAt: 1 },
    ]
    const result = buildMoodChartData(logs, ['A', 'B'])
    expect(result).toEqual([
      { date: '2026-01-01', a: 5, b: 8 },
      { date: '2026-01-02', a: 3, b: null },
    ])
  })

  it('keeps only the most recent 14 distinct dates', () => {
    const logs = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      value: i,
      who: 'A',
      createdAt: 1,
    }))
    const result = buildMoodChartData(logs, ['A', 'B'])
    expect(result).toHaveLength(14)
    expect(result[0].date).toBe('2026-01-07')
    expect(result[13].date).toBe('2026-01-20')
  })
})
