import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'))
const html = fs.readFileSync('index.html', 'utf8')
const sw = fs.readFileSync('public/sw.js', 'utf8')

describe('home screen app', () => {
  it('opens full screen from the root', () => {
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/')
    expect(manifest.name).toBe('우리의 이야기')
  })

  it('points at icon files that exist', () => {
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2)
    for (const icon of manifest.icons) expect(fs.existsSync(`public${icon.src}`)).toBe(true)
  })

  it('is linked from the page along with the iOS home screen icon', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest"')
    const touchIcon = html.match(/<link rel="apple-touch-icon" href="([^"]+)"/)
    expect(touchIcon).not.toBeNull()
    expect(fs.existsSync(`public${touchIcon![1]}`)).toBe(true)
    expect(html).toContain('name="apple-mobile-web-app-capable"')
  })

  it('has a service worker that shows pushes and reacts to taps', () => {
    expect(sw).toContain("addEventListener('push'")
    expect(sw).toContain("addEventListener('notificationclick'")
    expect(sw).toContain('showNotification')
  })
})
