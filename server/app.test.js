// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openDb } from './db.js'
import { createApp } from './app.js'

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

let tmp, db, app, uploadsDir

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'our-story-'))
  db = openDb(path.join(tmp, 'test.db'))
  uploadsDir = path.join(tmp, 'uploads')
  app = createApp({ db, uploadsDir })
})
afterEach(() => {
  db.close()
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('collections', () => {
  it('creates, lists (newest first), patches and deletes items', async () => {
    const a = await request(app).post('/api/bucket').send({ text: '제주', category: 'destination', done: false })
    expect(a.status).toBe(201)
    expect(a.body).toMatchObject({ text: '제주', done: false })
    expect(typeof a.body.id).toBe('string')
    expect(typeof a.body.createdAt).toBe('number')
    await new Promise((r) => setTimeout(r, 5))
    await request(app).post('/api/bucket').send({ text: '번지점프', category: 'challenge', done: false })

    const list = await request(app).get('/api/bucket')
    expect(list.body.map((i) => i.text)).toEqual(['번지점프', '제주'])

    const p = await request(app).patch(`/api/bucket/${a.body.id}`).send({ done: true })
    expect(p.body).toMatchObject({ id: a.body.id, text: '제주', done: true, createdAt: a.body.createdAt })

    expect((await request(app).delete(`/api/bucket/${a.body.id}`)).status).toBe(204)
    expect((await request(app).get('/api/bucket')).body).toHaveLength(1)
  })

  it('ignores client-sent id/createdAt on create', async () => {
    const r = await request(app).post('/api/notes').send({ id: 'hack', createdAt: 1, text: 'hi', sender: 'A' })
    expect(r.body.id).not.toBe('hack')
    expect(r.body.createdAt).not.toBe(1)
  })

  it('returns 404 for unknown collections and missing items', async () => {
    expect((await request(app).get('/api/rooms')).status).toBe(404)
    expect((await request(app).patch('/api/bucket/nope').send({ done: true })).status).toBe(404)
  })

  it('PUT upserts by id and keeps the original createdAt', async () => {
    const first = await request(app).put('/api/moods/2026-09-29_A').send({ date: '2026-09-29', who: 'A', value: 3 })
    expect(first.status).toBe(200)
    const second = await request(app).put('/api/moods/2026-09-29_A').send({ date: '2026-09-29', who: 'A', value: 9 })
    expect(second.body).toMatchObject({ id: '2026-09-29_A', value: 9, createdAt: first.body.createdAt })
    expect((await request(app).get('/api/moods')).body).toHaveLength(1)
  })

  it('persists across app instances on the same db file', async () => {
    await request(app).post('/api/places').send({ name: '강릉' })
    const app2 = createApp({ db, uploadsDir })
    expect((await request(app2).get('/api/places')).body[0].name).toBe('강릉')
  })
})

describe('settings', () => {
  it('returns defaults, merges patches and truncates names to 20 chars', async () => {
    expect((await request(app).get('/api/settings')).body).toEqual({ nameA: '나', nameB: '상대방', startDate: null })
    const r = await request(app).put('/api/settings').send({ nameA: 'x'.repeat(30), startDate: '2025-09-29' })
    expect(r.body).toEqual({ nameA: 'x'.repeat(20), nameB: '상대방', startDate: '2025-09-29' })
    expect((await request(app).get('/api/settings')).body.startDate).toBe('2025-09-29')
  })
})

describe('uploads', () => {
  it('stores an image data URL and serves it back', async () => {
    const r = await request(app).post('/api/uploads').send({ dataUrl: PNG_1PX })
    expect(r.status).toBe(201)
    expect(r.body.url).toMatch(/^\/uploads\/[\w-]+\.png$/)
    const img = await request(app).get(r.body.url)
    expect(img.status).toBe(200)
    expect(img.headers['content-type']).toMatch(/image\/png/)
  })

  it('accepts a ~2MB image payload', async () => {
    const big = 'data:image/jpeg;base64,' + Buffer.alloc(2_000_000, 1).toString('base64')
    expect((await request(app).post('/api/uploads').send({ dataUrl: big })).status).toBe(201)
  })

  it('rejects non-image data', async () => {
    expect((await request(app).post('/api/uploads').send({ dataUrl: 'data:text/html;base64,PGgxPg==' })).status).toBe(400)
    expect((await request(app).post('/api/uploads').send({})).status).toBe(400)
  })

  it('deletes the uploaded file when its item is deleted', async () => {
    const { body: up } = await request(app).post('/api/uploads').send({ dataUrl: PNG_1PX })
    const { body: place } = await request(app).post('/api/places').send({ name: 'p', photoUrl: up.url })
    const file = path.join(uploadsDir, path.basename(up.url))
    expect(fs.existsSync(file)).toBe(true)
    await request(app).delete(`/api/places/${place.id}`)
    expect(fs.existsSync(file)).toBe(false)
  })

  it('never deletes files outside the uploads folder', async () => {
    const outside = path.join(tmp, 'keep.txt')
    fs.writeFileSync(outside, 'x')
    const { body } = await request(app).post('/api/doodles').send({ imageUrl: '/uploads/../keep.txt', sender: 'A' })
    await request(app).delete(`/api/doodles/${body.id}`)
    expect(fs.existsSync(outside)).toBe(true)
  })
})
