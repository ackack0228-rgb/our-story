import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { LOCK_EMAIL } from './auth'

vi.mock('./supabase', () => ({ supabase: {} }))

// The admin scripts create the shared account; the app signs in to it. They run in different
// worlds (Node scripts vs the browser bundle), so the address is written down twice.
describe('the shared account address', () => {
  it('is the same in the app and in the admin scripts', () => {
    const script = readFileSync('scripts/supabase-admin-constants.mjs', 'utf8')
    expect(/LOCK_EMAIL = '([^']+)'/.exec(script)?.[1]).toBe(LOCK_EMAIL)
  })
})
