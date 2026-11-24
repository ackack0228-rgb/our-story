import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export const COLLECTIONS = ['places', 'doodles', 'notes', 'bucket', 'moods', 'archive', 'votes']
const DEFAULT_SETTINGS = { nameA: '나', nameB: '상대방', startDate: null }
const IMAGE_DATA_URL = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/
const IMAGE_FIELDS = ['photoUrl', 'imageUrl']

export function createApp({ db, uploadsDir }) {
  fs.mkdirSync(uploadsDir, { recursive: true })
  const app = express()
  app.use(express.json({ limit: '15mb' }))
  app.use('/uploads', express.static(uploadsDir))

  const selectOne = db.prepare('SELECT * FROM items WHERE collection = ? AND id = ?')
  const selectAll = db.prepare('SELECT * FROM items WHERE collection = ? ORDER BY created_at DESC')
  const upsert = db.prepare(
    `INSERT INTO items (collection, id, data, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data`
  )
  const remove = db.prepare('DELETE FROM items WHERE collection = ? AND id = ?')
  const selectSettings = db.prepare('SELECT data FROM settings WHERE id = 1')
  const saveSettings = db.prepare(
    'INSERT INTO settings (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data'
  )

  const toItem = (row) => ({ ...JSON.parse(row.data), id: row.id, createdAt: row.created_at })
  // id/createdAt are always server-owned — never stored inside the JSON blob.
  const cleanData = (body) => {
    const { id: _id, createdAt: _createdAt, ...rest } = body ?? {}
    return rest
  }
  const readSettings = () => {
    const row = selectSettings.get()
    return row ? { ...DEFAULT_SETTINGS, ...JSON.parse(row.data) } : { ...DEFAULT_SETTINGS }
  }
  const removeUploadedFiles = (data) => {
    for (const field of IMAGE_FIELDS) {
      const url = data[field]
      if (typeof url !== 'string' || !url.startsWith('/uploads/')) continue
      // basename strips any "../" so a crafted URL can't reach outside uploadsDir.
      fs.rmSync(path.join(uploadsDir, path.basename(url)), { force: true })
    }
  }

  app.get('/api/settings', (_req, res) => res.json(readSettings()))

  app.put('/api/settings', (req, res) => {
    const next = readSettings()
    for (const key of ['nameA', 'nameB']) {
      if (typeof req.body?.[key] === 'string') next[key] = req.body[key].slice(0, 20)
    }
    if (typeof req.body?.startDate === 'string' || req.body?.startDate === null) next.startDate = req.body.startDate
    saveSettings.run(JSON.stringify(next))
    res.json(next)
  })

  app.post('/api/uploads', (req, res) => {
    const match = typeof req.body?.dataUrl === 'string' && req.body.dataUrl.match(IMAGE_DATA_URL)
    if (!match) return res.status(400).json({ error: 'image data URL required' })
    const name = `${randomUUID()}.${match[1] === 'png' ? 'png' : 'jpg'}`
    fs.writeFileSync(path.join(uploadsDir, name), Buffer.from(match[2], 'base64'))
    res.status(201).json({ url: `/uploads/${name}` })
  })

  app.use('/api/:col', (req, res, next) => {
    if (COLLECTIONS.includes(req.params.col)) return next()
    res.status(404).json({ error: 'unknown collection' })
  })

  app.get('/api/:col', (req, res) => {
    res.json(selectAll.all(req.params.col).map(toItem))
  })

  app.post('/api/:col', (req, res) => {
    const id = randomUUID()
    upsert.run(req.params.col, id, JSON.stringify(cleanData(req.body)), Date.now())
    res.status(201).json(toItem(selectOne.get(req.params.col, id)))
  })

  app.put('/api/:col/:id', (req, res) => {
    const { col, id } = req.params
    upsert.run(col, id, JSON.stringify(cleanData(req.body)), Date.now())
    res.json(toItem(selectOne.get(col, id)))
  })

  app.patch('/api/:col/:id', (req, res) => {
    const { col, id } = req.params
    const row = selectOne.get(col, id)
    if (!row) return res.status(404).json({ error: 'not found' })
    upsert.run(col, id, JSON.stringify({ ...JSON.parse(row.data), ...cleanData(req.body) }), row.created_at)
    res.json(toItem(selectOne.get(col, id)))
  })

  app.delete('/api/:col/:id', (req, res) => {
    const { col, id } = req.params
    const row = selectOne.get(col, id)
    if (row) {
      remove.run(col, id)
      removeUploadedFiles(JSON.parse(row.data))
    }
    res.status(204).end()
  })

  app.use((err, _req, res, _next) => {
    const status = err.status && err.status < 500 ? err.status : 500
    if (status === 500) console.error(err)
    res.status(status).json({ error: err.message })
  })

  return app
}
