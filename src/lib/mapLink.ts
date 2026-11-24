export type MapLinkKind = 'kakao' | 'naver'

const HOSTS: Record<MapLinkKind, string[]> = {
  kakao: ['kko.to', 'kko.kakao.com', 'map.kakao.com'],
  naver: ['naver.me', 'map.naver.com', 'place.naver.com'],
}

const LABELS: Record<MapLinkKind, string> = { kakao: '카카오맵', naver: '네이버지도' }

/** Which map a link belongs to, or null if it is not a 카카오맵/네이버지도 link. */
export function mapLinkKind(url: string): MapLinkKind | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  const host = parsed.hostname.toLowerCase()
  for (const kind of Object.keys(HOSTS) as MapLinkKind[]) {
    if (HOSTS[kind].some((h) => host === h || host.endsWith(`.${h}`))) return kind
  }
  return null
}

/** The map apps copy the place name and address along with the link — take just the link. */
export function pickMapLink(pasted: string): string | null {
  const urls = pasted.match(/https?:\/\/\S+/g) ?? []
  return urls.find((u) => mapLinkKind(u) !== null) ?? null
}

export function mapLinkLabel(url: string): string | null {
  const kind = mapLinkKind(url)
  return kind ? LABELS[kind] : null
}
