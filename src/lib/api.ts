import { backend, type Row } from './supabaseBackend'
import { resolveUrls, toStoragePath } from './signedUrls'

export type CollectionName = 'places' | 'doodles' | 'notes' | 'bucket' | 'moods' | 'archive' | 'votes' | 'pokes' | 'events' | 'answers' | 'reactions' | 'balance' | 'games' | 'comments'

export interface Settings {
  nameA: string
  nameB: string
  startDate: string | null
}

const DEFAULT_SETTINGS: Settings = { nameA: '나', nameB: '상대방', startDate: null }
const IMAGE_FIELDS = ['photoUrl', 'imageUrl']
const IMAGE_DATA_URL = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/

// crypto.randomUUID only exists on HTTPS/localhost; getRandomValues works everywhere.
function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// id/createdAt belong to the row, never to the JSON blob; image fields are stored as bucket paths.
function cleanData(body: object): Record<string, unknown> {
  const { id: _id, createdAt: _createdAt, ...rest } = body as Record<string, unknown>
  for (const field of IMAGE_FIELDS) {
    const value = rest[field]
    if (typeof value === 'string') rest[field] = toStoragePath(value)
  }
  return rest
}

const imagePaths = (data: Record<string, unknown>) =>
  IMAGE_FIELDS.map((field) => data[field]).filter((v): v is string => typeof v === 'string' && v !== '')

async function toItems<T>(rows: Row[]): Promise<T[]> {
  const paths = rows.flatMap((row) => imagePaths(row.data))
  const urls = paths.length > 0 ? await resolveUrls('uploads', paths) : {}
  return rows.map((row) => {
    const data = { ...row.data }
    for (const field of IMAGE_FIELDS) {
      const path = data[field]
      if (typeof path === 'string' && urls[path]) data[field] = urls[path]
    }
    return { ...data, id: row.id, createdAt: row.created_at } as T
  })
}

const toItem = async <T>(row: Row) => (await toItems<T>([row]))[0]

// For a row that was just written. The write is what the caller asked for, so a failure to make the
// photo link afterwards must not look like a failed save — callers delete the uploaded photo and
// retry on failure. The plain path goes back instead; the next load turns it into a link.
async function savedItem<T>(row: Row): Promise<T> {
  try {
    return await toItem<T>(row)
  } catch {
    return { ...row.data, id: row.id, createdAt: row.created_at } as T
  }
}

export async function listItems<T>(col: CollectionName): Promise<T[]> {
  return toItems<T>(await backend.selectAll(col))
}

export async function createItem<T>(col: CollectionName, data: object): Promise<T> {
  const row: Row = { id: newId(), data: cleanData(data), created_at: Date.now() }
  await backend.insert(col, row)
  return savedItem<T>(row)
}

// Upsert that keeps the original createdAt — used for ids the client derives (moods: `${date}_${who}`).
export async function putItem<T>(col: CollectionName, id: string, data: object): Promise<T> {
  let existing = await backend.selectOne(col, id)
  const cleaned = cleanData(data)
  if (!existing) {
    try {
      const row: Row = { id, data: cleaned, created_at: Date.now() }
      await backend.insert(col, row)
      return savedItem<T>(row)
    } catch (error) {
      // Another save of the same id (a double tap, or the other phone) may have made the row between
      // the read and the insert. If it is there now, this save becomes an update of it.
      existing = await backend.selectOne(col, id)
      if (!existing) throw error
    }
  }
  await backend.updateData(col, id, cleaned)
  return savedItem<T>({ id, data: cleaned, created_at: existing.created_at })
}

export async function patchItem<T>(col: CollectionName, id: string, patch: object): Promise<T> {
  const existing = await backend.selectOne(col, id)
  if (!existing) throw new Error(`PATCH ${col}/${id} failed: 404`)
  const row: Row = { ...existing, data: { ...existing.data, ...cleanData(patch) } }
  await backend.updateData(col, id, row.data)
  return savedItem<T>(row)
}

export async function deleteItem(col: CollectionName, id: string): Promise<void> {
  const existing = await backend.selectOne(col, id)
  if (!existing) return
  await backend.remove(col, id)
  await discardUploads(imagePaths(existing.data))
}

async function discardUploads(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  try {
    await backend.removeFiles(paths)
  } catch {
    // The record is what matters; a leftover file only costs a little storage.
  }
}

// For callers that uploaded an image and then failed to save the item that points at it.
export async function discardUpload(path: string | null): Promise<void> {
  if (path) await discardUploads([toStoragePath(path)])
}

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...((await backend.getSettingsData()) ?? {}) } as Settings
}

export async function putSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = await getSettings()
  if (typeof patch.nameA === 'string') next.nameA = patch.nameA.slice(0, 20)
  if (typeof patch.nameB === 'string') next.nameB = patch.nameB.slice(0, 20)
  if (typeof patch.startDate === 'string' || patch.startDate === null) next.startDate = patch.startDate
  await backend.saveSettingsData({ nameA: next.nameA, nameB: next.nameB, startDate: next.startDate })
  return { nameA: next.nameA, nameB: next.nameB, startDate: next.startDate }
}

// Returns the bucket path (e.g. "<uuid>.jpg") to store in a document's photoUrl/imageUrl.
export async function uploadImage(dataUrl: string): Promise<string> {
  const match = dataUrl.match(IMAGE_DATA_URL)
  if (!match) throw new Error('image data URL required')
  const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0))
  const path = `${newId()}.${match[1] === 'png' ? 'png' : 'jpg'}`
  await backend.uploadFile(path, new Blob([bytes], { type: `image/${match[1]}` }))
  return path
}

// Photos come out of imageResize as data URLs; anything else (a path or signed URL already in
// storage, or null) passes through untouched.
export async function uploadIfDataUrl(value: string | null): Promise<string | null> {
  return value && value.startsWith('data:') ? uploadImage(value) : value
}
