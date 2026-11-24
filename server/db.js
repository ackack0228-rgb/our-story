import { createRequire } from 'node:module'

// Vite/Vitest 5 doesn't know the `node:sqlite` builtin yet — load it through require so the
// bundler never tries to resolve it.
const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite')

export function openDb(filePath) {
  const db = new DatabaseSync(filePath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      collection TEXT NOT NULL,
      id         TEXT NOT NULL,
      data       TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (collection, id)
    );
    CREATE TABLE IF NOT EXISTS settings (
      id   INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );
  `)
  return db
}
