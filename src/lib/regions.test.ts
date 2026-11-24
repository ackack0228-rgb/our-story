import { describe, it, expect } from 'vitest'
import { findRegion, KOREA_MAP, placesIn, placesWithoutRegion, regionGroups, regionLabel, REGIONS, visitedRegionIds, visitCounts, visitShade } from './regions'
import type { Place } from './places'

function place(over: Partial<Place>): Place {
  return { id: 'p', name: '곳', date: '2026-01-01', mood: '🌊', diary: '', photoUrl: null, createdBy: 'A', createdAt: 1, ...over }
}

describe('the map data', () => {
  it('has every 시·군, with the big cities as one area each', () => {
    expect(REGIONS).toHaveLength(161)
    expect(new Set(REGIONS.map((r) => r.id)).size).toBe(161)
    expect(REGIONS.filter((r) => !r.province).map((r) => r.name)).toEqual(['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종'])
  })

  it('merges the 구 of a city into the city', () => {
    const suwon = REGIONS.filter((r) => r.name.startsWith('수원'))
    expect(suwon.map((r) => [r.province, r.name])).toEqual([['경기', '수원시']])
  })

  it('gives every area a drawable shape inside the map', () => {
    for (const r of REGIONS) {
      expect(r.d, r.name).toMatch(/^M\d+,\d+l/)
      const [x, y] = r.d.slice(1).split('l')[0].split(',').map(Number)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(KOREA_MAP.width)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(KOREA_MAP.height)
    }
  })

  it('prints a short name on every area, placed inside the map', () => {
    expect(findRegion('3101')!.label.text).toBe('수원')
    expect(findRegion('31370')!.label.text).toBe('가평')
    expect(findRegion('11')!.label.text).toBe('서울')
    expect(findRegion('39020')!.label.text).toBe('서귀포')
    for (const r of REGIONS) {
      expect(r.label.text.length, r.name).toBeGreaterThanOrEqual(2)
      expect(r.label.size, r.name).toBeGreaterThan(0)
      expect(r.label.x).toBeGreaterThan(0)
      expect(r.label.x).toBeLessThan(KOREA_MAP.width)
      expect(r.label.y).toBeGreaterThan(0)
      expect(r.label.y).toBeLessThan(KOREA_MAP.height)
    }
  })

  it('boxes the far islands', () => {
    expect(KOREA_MAP.insets.map((b) => b.label)).toEqual(['울릉도 · 독도', '제주도'])
  })
})

describe('regionLabel', () => {
  it('names a big city alone and other areas with their province', () => {
    expect(regionLabel(findRegion('21')!)).toBe('부산')
    expect(regionLabel(findRegion('3101')!)).toBe('경기 수원시')
  })

  it('never gives two areas the same label', () => {
    const labels = REGIONS.map(regionLabel)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels).toContain('강원 고성군')
    expect(labels).toContain('경남 고성군')
    expect(labels).toContain('광주')
    expect(labels).toContain('경기 광주시')
  })
})

describe('findRegion', () => {
  it('finds by id and gives null for anything else', () => {
    expect(findRegion('11')?.name).toBe('서울')
    expect(findRegion('nope')).toBeNull()
    expect(findRegion(undefined)).toBeNull()
    expect(findRegion('')).toBeNull()
  })
})

describe('regionGroups', () => {
  it('lists the big cities first, then each province once, covering every area', () => {
    const groups = regionGroups()
    expect(groups.map((g) => g.label)).toEqual(['특별시 · 광역시', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'])
    expect(groups.reduce((n, g) => n + g.regions.length, 0)).toBe(161)
  })
})

describe('visitedRegionIds', () => {
  it('collects each visited area once and ignores places without a known area', () => {
    const ids = visitedRegionIds([
      place({ region: '21' }), place({ id: 'b', region: '21' }), place({ id: 'c', region: '32030' }),
      place({ id: 'old' }), place({ id: 'bad', region: 'nope' }),
    ])
    expect([...ids].sort()).toEqual(['21', '32030'])
  })
})

describe('placesIn', () => {
  it('gives that area’s places, newest first', () => {
    const list = [
      place({ id: 'old', region: '21', date: '2025-01-01' }),
      place({ id: 'other', region: '11', date: '2026-05-05' }),
      place({ id: 'new', region: '21', date: '2026-03-01' }),
    ]
    expect(placesIn(list, '21').map((p) => p.id)).toEqual(['new', 'old'])
    expect(placesIn(list, '39010')).toEqual([])
  })
})

describe('placesWithoutRegion', () => {
  it('finds places from before the map had areas', () => {
    const list = [place({ id: 'a', region: '21' }), place({ id: 'old' }), place({ id: 'bad', region: 'nope' })]
    expect(placesWithoutRegion(list).map((p) => p.id)).toEqual(['old', 'bad'])
  })
})

describe('visitCounts and visitShade', () => {
  it('counts records per known area', () => {
    const counts = visitCounts([place({ region: '21' }), place({ id: 'b', region: '21' }), place({ id: 'c', region: '32030' }), place({ id: 'bad', region: 'nope' })])
    expect(Object.fromEntries(counts)).toEqual({ '21': 2, '32030': 1 })
  })

  it('shades 1 lightly, 2–3 in the middle and 4+ deepest', () => {
    expect([1, 2, 3, 4, 9].map(visitShade)).toEqual(['once', 'few', 'few', 'many', 'many'])
  })
})
