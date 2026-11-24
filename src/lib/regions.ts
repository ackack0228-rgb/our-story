import data from '../features/map/koreaRegions.json'
import type { Place } from './places'

// One area of the map: a 시 or 군, or a whole 특별시/광역시. Made by scripts/build-korea-regions.cjs.
export interface Region {
  id: string
  /** '서울', '수원시', '가평군' */
  name: string
  /** '경기', '강원' … — empty for a 특별시/광역시, whose name stands alone */
  province: string
  /** The name as printed on the map ('수원', '가평'), where it sits and how large it can be there */
  label: { text: string; x: number; y: number; size: number }
  /** SVG path in the map's own coordinates */
  d: string
}

export interface MapInset {
  label: string
  x: number
  y: number
  width: number
  height: number
}

export const KOREA_MAP: { width: number; height: number; insets: MapInset[]; regions: Region[] } = data
export const REGIONS = KOREA_MAP.regions

const BY_ID = new Map(REGIONS.map((r) => [r.id, r]))

export function findRegion(id: string | null | undefined): Region | null {
  return (id && BY_ID.get(id)) || null
}

/** '서울', '경기 수원시' — the province tells 강원 고성군 from 경남 고성군 and 광주 from 경기 광주시. */
export function regionLabel(region: Region): string {
  return region.province ? `${region.province} ${region.name}` : region.name
}

/** The areas for a picker, the big cities first and then province by province. */
export function regionGroups(): { label: string; regions: Region[] }[] {
  const groups: { label: string; regions: Region[] }[] = []
  for (const r of REGIONS) {
    const label = r.province || '특별시 · 광역시'
    const last = groups[groups.length - 1]
    if (last?.label === label) last.regions.push(r)
    else groups.push({ label, regions: [r] })
  }
  return groups
}

/** How many places each area has. Areas with none, and places whose area the map does not know, are left out. */
export function visitCounts(places: Place[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const p of places) if (p.region && BY_ID.has(p.region)) counts.set(p.region, (counts.get(p.region) ?? 0) + 1)
  return counts
}

/** Ids of the areas that have at least one place. */
export function visitedRegionIds(places: Place[]): Set<string> {
  return new Set(visitCounts(places).keys())
}

export type VisitShade = 'once' | 'few' | 'many'

/** How deep an area is coloured: 1 record, 2–3, or 4 and more. */
export function visitShade(count: number): VisitShade {
  return count >= 4 ? 'many' : count >= 2 ? 'few' : 'once'
}

/** The places in one area, newest first. */
export function placesIn(places: Place[], regionId: string): Place[] {
  return places.filter((p) => p.region === regionId).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/** Places saved before the map had areas, or pointing at an area it no longer has. */
export function placesWithoutRegion(places: Place[]): Place[] {
  return places.filter((p) => !findRegion(p.region))
}
