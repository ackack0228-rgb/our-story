import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDb } from './db.js'
import { createApp } from './app.js'

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
fs.mkdirSync(dataDir, { recursive: true })

const db = openDb(path.join(dataDir, 'our-story.db'))
const app = createApp({ db, uploadsDir: path.join(dataDir, 'uploads') })
const PORT = Number(process.env.PORT) || 4000

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] listening on http://0.0.0.0:${PORT} (data: ${dataDir})`)
})
