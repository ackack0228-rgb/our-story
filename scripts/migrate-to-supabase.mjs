// 노트북의 SQLite + uploads 폴더를 Supabase로 옮긴다. 여러 번 실행해도 중복이 생기지 않는다.
// 사용: npm run migrate          (--dry-run 을 붙이면 읽기만 하고 아무것도 올리지 않는다)
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite')

const DATA_DIR = path.resolve('server/data')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
const COLLECTIONS = ['places', 'doodles', 'notes', 'bucket', 'moods', 'archive', 'votes']
const IMAGE_FIELDS = ['photoUrl', 'imageUrl']
const dryRun = process.argv.includes('--dry-run')

export function toPath(value) {
  return typeof value === 'string' && value.startsWith('/uploads/') ? value.slice('/uploads/'.length) : value
}

export function convertRow(row) {
  const data = JSON.parse(row.data)
  for (const field of IMAGE_FIELDS) if (field in data) data[field] = toPath(data[field])
  return { collection: row.collection, id: row.id, data, created_at: row.created_at }
}

const fail = (message) => {
  console.error(`실패: ${message}`)
  process.exit(1)
}

const local = new DatabaseSync(path.join(DATA_DIR, 'our-story.db'), { readOnly: true })
const rows = local.prepare('SELECT collection, id, data, created_at FROM items').all().map(convertRow)
const settingsRow = local.prepare('SELECT data FROM settings WHERE id = 1').get()
const files = fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR).filter((f) => /\.(jpg|png)$/.test(f)) : []

console.log(`노트북: 항목 ${rows.length}개, 사진 ${files.length}개, 설정 ${settingsRow ? '있음' : '없음'}`)
for (const col of COLLECTIONS) console.log(`  ${col}: ${rows.filter((r) => r.collection === col).length}`)

const unknown = rows.filter((r) => !COLLECTIONS.includes(r.collection))
if (unknown.length) fail(`알 수 없는 컬렉션의 항목 ${unknown.length}개`)
const referenced = rows.flatMap((r) => IMAGE_FIELDS.map((f) => r.data[f])).filter((v) => typeof v === 'string' && v)
const missing = referenced.filter((p) => !files.includes(p))
if (missing.length) console.warn(`경고: 항목이 가리키는데 파일이 없는 사진 ${missing.length}개: ${missing.join(', ')}`)

if (dryRun) {
  console.log('--dry-run: 아무것도 올리지 않았어요')
  process.exit(0)
}

const remote = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

for (const name of files) {
  const { error } = await remote.storage.from('uploads').upload(name, fs.readFileSync(path.join(UPLOADS_DIR, name)), {
    contentType: name.endsWith('.png') ? 'image/png' : 'image/jpeg',
    upsert: true,
  })
  if (error) fail(`사진 ${name}: ${error.message}`)
}

if (rows.length) {
  const { error } = await remote.from('items').upsert(rows, { onConflict: 'collection,id' })
  if (error) fail(`항목: ${error.message}`)
}

if (settingsRow) {
  const { error } = await remote.from('settings').upsert({ id: 1, data: JSON.parse(settingsRow.data) })
  if (error) fail(`설정: ${error.message}`)
}

// 검증: 노트북의 모든 항목 id와 사진이 Supabase에 있어야 한다.
let problems = 0
for (const col of COLLECTIONS) {
  const { data, error } = await remote.from('items').select('id').eq('collection', col)
  if (error) fail(`검증(${col}): ${error.message}`)
  const remoteIds = new Set(data.map((r) => r.id))
  const lost = rows.filter((r) => r.collection === col && !remoteIds.has(r.id))
  console.log(`  ${col}: 노트북 ${rows.filter((r) => r.collection === col).length} / Supabase ${data.length}${lost.length ? `  ← ${lost.length}개 누락` : ''}`)
  problems += lost.length
}
const { data: listed, error: listError } = await remote.storage.from('uploads').list('', { limit: 10000 })
if (listError) fail(`검증(사진): ${listError.message}`)
const remoteFiles = new Set(listed.map((f) => f.name))
const lostFiles = files.filter((f) => !remoteFiles.has(f))
console.log(`  사진: 노트북 ${files.length} / Supabase ${listed.length}${lostFiles.length ? `  ← ${lostFiles.length}개 누락` : ''}`)
problems += lostFiles.length

console.log(problems ? `실패: ${problems}개가 옮겨지지 않았어요` : '완료: 전부 옮겼어요')
process.exit(problems ? 1 : 0)
