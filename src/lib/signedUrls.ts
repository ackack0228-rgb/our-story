import { backend } from './supabaseBackend'

const STORE_KEY = 'signedUrls'
export const SIGN_TTL_S = 7 * 24 * 60 * 60
const REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000

type Entry = { url: string; exp: number }
let memory: Record<string, Entry> | null = null

function load(): Record<string, Entry> {
  if (memory) return memory
  try {
    memory = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Record<string, Entry>
  } catch {
    memory = {}
  }
  return memory
}

function save(cache: Record<string, Entry>) {
  memory = cache
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(cache))
  } catch {
    // Private mode / full storage — the in-memory copy still serves this visit.
  }
}

// Private-bucket files are shown through signed URLs. A path keeps the same URL until a day
// before it expires: the 3-second poll must not hand <img> a new src each time, and a stable URL
// (kept across reloads in localStorage) lets the browser cache the image instead of re-downloading.
export async function resolveUrls(bucket: string, paths: string[]): Promise<Record<string, string>> {
  const now = Date.now()
  const unique = [...new Set(paths)]
  const stale = unique.filter((p) => {
    const entry = load()[`${bucket}/${p}`]
    return !entry || entry.exp - now < REFRESH_MARGIN_MS
  })
  if (stale.length > 0) {
    const signed = await backend.signUrls(bucket, stale, SIGN_TTL_S)
    const next: Record<string, Entry> = {}
    for (const [key, entry] of Object.entries(load())) if (entry.exp > now) next[key] = entry
    for (const p of stale) {
      if (signed[p]) next[`${bucket}/${p}`] = { url: signed[p], exp: now + SIGN_TTL_S * 1000 }
      else delete next[`${bucket}/${p}`]
    }
    save(next)
  }
  const urls: Record<string, string> = {}
  for (const p of unique) {
    const entry = load()[`${bucket}/${p}`]
    if (entry) urls[p] = entry.url
  }
  return urls
}

export function clearSignedUrlCache() {
  memory = null
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {
    // ignore
  }
}

// Documents store bucket paths. Screens only ever see signed URLs, so anything they send back
// (or an old "/uploads/x.jpg" from the laptop server) is reduced to the path before saving.
export function toStoragePath(value: string): string {
  const signed = value.match(/\/storage\/v1\/object\/sign\/[^/]+\/([^?]+)/)
  if (signed) return decodeURIComponent(signed[1])
  return value.startsWith('/uploads/') ? value.slice('/uploads/'.length) : value
}
