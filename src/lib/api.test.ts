import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createItem, deleteItem, discardUpload, getSettings, listItems, patchItem, putItem, putSettings,
  uploadIfDataUrl, uploadImage,
} from './api'
import { clearSignedUrlCache } from './signedUrls'

// In-memory stand-in for Supabase: a table of rows, one settings blob, and a file bucket.
const fake = vi.hoisted(() => {
  type Row = { id: string; data: Record<string, unknown>; created_at: number }
  const rows = new Map<string, Row>()
  const files = new Map<string, Blob>()
  const state = {
    settings: null as Record<string, unknown> | null, signCalls: 0, failRemoveFiles: false,
    failSign: false, hideNextSelectOne: false,
  }
  const key = (col: string, id: string) => `${col}/${id}`
  return {
    rows, files, state,
    reset() {
      rows.clear(); files.clear(); state.settings = null; state.signCalls = 0; state.failRemoveFiles = false
      state.failSign = false; state.hideNextSelectOne = false
    },
    backend: {
      async selectAll(col: string) {
        return [...rows.entries()].filter(([k]) => k.startsWith(`${col}/`)).map(([, r]) => structuredClone(r))
          .sort((a, b) => b.created_at - a.created_at)
      },
      async selectOne(col: string, id: string) {
        // Stands in for a second save racing the first: the row is there but this read missed it.
        if (state.hideNextSelectOne) { state.hideNextSelectOne = false; return null }
        const r = rows.get(key(col, id)); return r ? structuredClone(r) : null
      },
      async insert(col: string, row: Row) {
        if (rows.has(key(col, row.id))) throw new Error('duplicate key value violates unique constraint "items_pkey"')
        rows.set(key(col, row.id), structuredClone(row))
      },
      async updateData(col: string, id: string, data: Record<string, unknown>) {
        rows.set(key(col, id), { ...rows.get(key(col, id))!, data: structuredClone(data) })
      },
      async remove(col: string, id: string) { rows.delete(key(col, id)) },
      async getSettingsData() { return state.settings },
      async saveSettingsData(data: Record<string, unknown>) { state.settings = data },
      async uploadFile(path: string, blob: Blob) { files.set(path, blob) },
      async removeFiles(paths: string[]) {
        if (state.failRemoveFiles) throw new Error('storage down')
        paths.forEach((p) => files.delete(p))
      },
      async signUrls(bucket: string, paths: string[]) {
        state.signCalls++
        if (state.failSign) throw new Error('network blip')
        return Object.fromEntries(
          paths.filter((p) => files.has(p)).map((p) => [p, `https://x.supabase.co/storage/v1/object/sign/${bucket}/${p}?token=t`]),
        )
      },
    },
  }
})
vi.mock('./supabaseBackend', () => ({ backend: fake.backend }))

const signed = (path: string) => `https://x.supabase.co/storage/v1/object/sign/uploads/${path}?token=t`
const PNG = 'data:image/png;base64,iVBORw0KGgo='

beforeEach(() => {
  fake.reset()
  clearSignedUrlCache()
})

describe('items', () => {
  it('creates with a server-side id and timestamp, ignoring ones the caller sent', async () => {
    const before = Date.now()
    const item = await createItem<{ id: string; text: string; createdAt: number }>('notes', { id: 'mine', createdAt: 1, text: 'a' })
    expect(item.text).toBe('a')
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(item.createdAt).toBeGreaterThanOrEqual(before)
    expect(fake.rows.get(`notes/${item.id}`)!.data).toEqual({ text: 'a' })
  })

  it('lists one collection newest first with id and createdAt on each item', async () => {
    await fake.backend.insert('notes', { id: 'old', data: { text: 'old' }, created_at: 1 })
    await fake.backend.insert('notes', { id: 'new', data: { text: 'new' }, created_at: 2 })
    await fake.backend.insert('bucket', { id: 'b', data: { text: 'other' }, created_at: 3 })
    expect(await listItems('notes')).toEqual([
      { id: 'new', text: 'new', createdAt: 2 },
      { id: 'old', text: 'old', createdAt: 1 },
    ])
  })

  it('lists an empty collection as an empty array', async () => {
    expect(await listItems('votes')).toEqual([])
  })

  it('patch merges into the existing data and keeps createdAt', async () => {
    await fake.backend.insert('bucket', { id: 'b1', data: { text: 't', done: false }, created_at: 5 })
    expect(await patchItem('bucket', 'b1', { done: true })).toEqual({ id: 'b1', text: 't', done: true, createdAt: 5 })
  })

  it('patch on a missing item fails instead of creating it', async () => {
    await expect(patchItem('bucket', 'nope', { done: true })).rejects.toThrow(/404/)
    expect(fake.rows.size).toBe(0)
  })

  it('put creates when missing and replaces data while keeping createdAt when present', async () => {
    const first = await putItem<{ createdAt: number; value: number }>('moods', '2026-10-06_A', { date: '2026-10-06', who: 'A', value: 3 })
    const second = await putItem<{ createdAt: number; value: number }>('moods', '2026-10-06_A', { date: '2026-10-06', who: 'A', value: 8 })
    expect(second.value).toBe(8)
    expect(second.createdAt).toBe(first.createdAt)
    expect(fake.rows.size).toBe(1)
  })

  it('delete removes the row and its image file', async () => {
    fake.files.set('p.jpg', new Blob(['x']))
    await fake.backend.insert('places', { id: 'p1', data: { name: 'n', photoUrl: 'p.jpg' }, created_at: 1 })
    await deleteItem('places', 'p1')
    expect(fake.rows.size).toBe(0)
    expect(fake.files.has('p.jpg')).toBe(false)
  })

  it('delete still succeeds when the file cleanup fails', async () => {
    fake.files.set('p.jpg', new Blob(['x']))
    await fake.backend.insert('places', { id: 'p1', data: { photoUrl: 'p.jpg' }, created_at: 1 })
    fake.state.failRemoveFiles = true
    await expect(deleteItem('places', 'p1')).resolves.toBeUndefined()
    expect(fake.rows.size).toBe(0)
  })

  it('deleting a missing item is not an error', async () => {
    await expect(deleteItem('notes', 'nope')).resolves.toBeUndefined()
  })
})

describe('images', () => {
  it('uploads a data URL into the bucket and returns its path', async () => {
    const path = await uploadImage(PNG)
    expect(path).toMatch(/^[0-9a-f-]{36}\.png$/)
    expect(fake.files.get(path)!.type).toBe('image/png')
  })

  it('names JPEGs .jpg', async () => {
    expect(await uploadImage('data:image/jpeg;base64,AAAA')).toMatch(/\.jpg$/)
  })

  it('rejects anything that is not a JPEG/PNG data URL', async () => {
    await expect(uploadImage('data:text/html;base64,AAAA')).rejects.toThrow()
    await expect(uploadImage('https://example.com/a.png')).rejects.toThrow()
    expect(fake.files.size).toBe(0)
  })

  it('uploadIfDataUrl uploads data URLs and passes everything else through', async () => {
    expect(await uploadIfDataUrl(PNG)).toMatch(/\.png$/)
    expect(await uploadIfDataUrl('old.jpg')).toBe('old.jpg')
    expect(await uploadIfDataUrl(null)).toBeNull()
    expect(fake.files.size).toBe(1)
  })

  it('shows stored paths as signed URLs when listing', async () => {
    fake.files.set('p.jpg', new Blob(['x']))
    await fake.backend.insert('places', { id: 'p1', data: { name: 'n', photoUrl: 'p.jpg' }, created_at: 1 })
    await fake.backend.insert('places', { id: 'p2', data: { name: 'm', photoUrl: null }, created_at: 2 })
    const [noPhoto, withPhoto] = await listItems<{ photoUrl: string | null }>('places')
    expect(withPhoto.photoUrl).toBe(signed('p.jpg'))
    expect(noPhoto.photoUrl).toBeNull()
  })

  it('keeps handing out the same URL across polls without signing again', async () => {
    fake.files.set('d.png', new Blob(['x']))
    await fake.backend.insert('doodles', { id: 'd1', data: { imageUrl: 'd.png', sender: 'A' }, created_at: 1 })
    const first = await listItems<{ imageUrl: string }>('doodles')
    const second = await listItems<{ imageUrl: string }>('doodles')
    expect(second[0].imageUrl).toBe(first[0].imageUrl)
    expect(fake.state.signCalls).toBe(1)
  })

  it('never stores a signed URL: writes reduce it back to the path', async () => {
    fake.files.set('p.jpg', new Blob(['x']))
    await fake.backend.insert('places', { id: 'p1', data: { name: 'n', photoUrl: 'p.jpg' }, created_at: 1 })
    await patchItem('places', 'p1', { name: 'renamed', photoUrl: signed('p.jpg') })
    expect(fake.rows.get('places/p1')!.data).toEqual({ name: 'renamed', photoUrl: 'p.jpg' })
    const created = await createItem<{ id: string }>('doodles', { imageUrl: signed('p.jpg'), sender: 'A' })
    expect(fake.rows.get(`doodles/${created.id}`)!.data.imageUrl).toBe('p.jpg')
  })

  it('discardUpload removes a file and swallows failures', async () => {
    fake.files.set('x.png', new Blob(['x']))
    await discardUpload('x.png')
    expect(fake.files.has('x.png')).toBe(false)
    fake.state.failRemoveFiles = true
    await expect(discardUpload('y.png')).resolves.toBeUndefined()
    await expect(discardUpload(null)).resolves.toBeUndefined()
  })
})

describe('settings', () => {
  it('falls back to defaults when nothing is saved', async () => {
    expect(await getSettings()).toEqual({ nameA: '나', nameB: '상대방', startDate: null })
  })

  it('merges a patch, trims names to 20 characters, and ignores unknown keys', async () => {
    await putSettings({ nameA: '가'.repeat(30), startDate: '2025-09-29' })
    const next = await putSettings({ nameB: '을', hacked: true } as never)
    expect(next).toEqual({ nameA: '가'.repeat(20), nameB: '을', startDate: '2025-09-29' })
    expect(fake.state.settings).toEqual(next)
  })

  it('can clear the start date', async () => {
    await putSettings({ startDate: '2025-09-29' })
    expect((await putSettings({ startDate: null })).startDate).toBeNull()
  })
})

describe('a write that reached the database', () => {
  it('counts as saved even when the photo link cannot be made right after', async () => {
    const path = await uploadImage(PNG)
    fake.state.failSign = true
    const item = await createItem<{ id: string; photoUrl: string }>('places', { name: '부산', photoUrl: path })
    expect(item.photoUrl).toBe(path)
    expect(fake.rows.get(`places/${item.id}`)!.data.photoUrl).toBe(path)
    expect(fake.files.has(path)).toBe(true)
  })

  it('counts an edit as saved the same way', async () => {
    const path = await uploadImage(PNG)
    await fake.backend.insert('places', { id: 'p1', data: { name: '부산' }, created_at: 1 })
    fake.state.failSign = true
    const item = await patchItem<{ photoUrl: string }>('places', 'p1', { photoUrl: path })
    expect(item.photoUrl).toBe(path)
    expect(fake.rows.get('places/p1')!.data.photoUrl).toBe(path)
  })

  it('shows the photo again on the next load', async () => {
    const path = await uploadImage(PNG)
    fake.state.failSign = true
    await createItem('places', { name: '부산', photoUrl: path })
    fake.state.failSign = false
    expect((await listItems<{ photoUrl: string }>('places'))[0].photoUrl).toBe(signed(path))
  })
})

describe('putItem when two saves of the same id cross', () => {
  it('keeps the later value instead of failing on the row the other save just made', async () => {
    await fake.backend.insert('moods', { id: '2026-10-08_A', data: { value: 3 }, created_at: 5 })
    fake.state.hideNextSelectOne = true
    const item = await putItem<{ value: number; createdAt: number }>('moods', '2026-10-08_A', { value: 9 })
    expect(item.value).toBe(9)
    expect(fake.rows.get('moods/2026-10-08_A')).toEqual({ id: '2026-10-08_A', data: { value: 9 }, created_at: 5 })
  })

  it('still fails when the insert broke for another reason', async () => {
    const insert = fake.backend.insert
    fake.backend.insert = async () => { throw new Error('denied') }
    await expect(putItem('moods', 'x', { value: 1 })).rejects.toThrow('denied')
    fake.backend.insert = insert
  })
})
