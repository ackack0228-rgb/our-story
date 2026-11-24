import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { enablePush, getPushState, subscriptionRow, syncPushWho, urlBase64ToUint8Array } from './push'
import { backend } from './supabaseBackend'

vi.mock('./supabaseBackend', () => ({ backend: { savePushSubscription: vi.fn().mockResolvedValue(undefined) } }))

const subJson = { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'P', auth: 'A' } }
const subscription = { toJSON: () => subJson, unsubscribe: vi.fn().mockResolvedValue(true) }

// Installs a fake browser push stack; returns the pieces tests poke at.
function installPush({ existing = false, permission = 'default' as NotificationPermission, registered = true } = {}) {
  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(existing ? subscription : null),
    subscribe: vi.fn().mockResolvedValue(subscription),
  }
  const registration = { pushManager }
  vi.stubGlobal('PushManager', class {})
  vi.stubGlobal('Notification', { permission, requestPermission: vi.fn().mockResolvedValue('granted') })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: vi.fn().mockResolvedValue(registration),
      // Like the real thing, ready never settles when no service worker was registered.
      ready: registered ? Promise.resolve(registration) : new Promise(() => {}),
      getRegistration: vi.fn().mockResolvedValue(registered ? registration : undefined),
    },
  })
  return { pushManager }
}

beforeEach(() => {
  vi.mocked(backend.savePushSubscription).mockClear()
  subscription.unsubscribe.mockClear()
})
afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'serviceWorker')
  Reflect.deleteProperty(navigator, 'standalone')
})

describe('urlBase64ToUint8Array', () => {
  it('decodes url-safe base64 without padding', () => {
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([251, 255])
  })
})

describe('subscriptionRow', () => {
  it('flattens a browser subscription into a table row', () => {
    expect(subscriptionRow(subJson, 'B', 123)).toEqual({
      endpoint: 'https://web.push.apple.com/abc', p256dh: 'P', auth: 'A', who: 'B', created_at: 123,
    })
  })
  it('rejects a subscription without keys', () => {
    expect(() => subscriptionRow({ endpoint: 'https://x' }, 'A', 1)).toThrow()
  })
})

describe('getPushState', () => {
  it('is unsupported where there is no service worker', async () => {
    expect(await getPushState()).toBe('unsupported')
  })

  it('asks for a home screen install on iOS Safari tabs (service worker but no PushManager)', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {} })
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: false })
    expect(await getPushState()).toBe('needs-install')
  })

  it('is denied once the user has refused', async () => {
    installPush({ permission: 'denied' })
    expect(await getPushState()).toBe('denied')
  })

  it('is on only when permission is granted and a subscription exists', async () => {
    installPush({ existing: true, permission: 'granted' })
    expect(await getPushState()).toBe('on')
  })

  it('is off when permission was granted but the subscription is gone', async () => {
    installPush({ existing: false, permission: 'granted' })
    expect(await getPushState()).toBe('off')
  })

  it('is off, rather than waiting forever, when the service worker never registered', async () => {
    installPush({ permission: 'granted', registered: false })
    expect(await getPushState()).toBe('off')
  })
})

describe('enablePush', () => {
  it('subscribes and saves the subscription under who I am', async () => {
    const { pushManager } = installPush()
    expect(await enablePush('B')).toBe('on')
    expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }))
    expect(backend.savePushSubscription).toHaveBeenCalledWith(expect.objectContaining({ endpoint: subJson.endpoint, who: 'B' }))
  })

  it('reports denied and saves nothing when permission is refused', async () => {
    installPush()
    vi.mocked(Notification.requestPermission).mockResolvedValue('denied')
    expect(await enablePush('A')).toBe('denied')
    expect(backend.savePushSubscription).not.toHaveBeenCalled()
  })

  it('stays off, so it can be asked again, when the prompt is closed without an answer', async () => {
    installPush()
    vi.mocked(Notification.requestPermission).mockResolvedValue('default')
    expect(await enablePush('A')).toBe('off')
    expect(backend.savePushSubscription).not.toHaveBeenCalled()
  })

  it('does not leave the phone looking subscribed when the server never got the subscription', async () => {
    installPush()
    vi.mocked(backend.savePushSubscription).mockRejectedValueOnce(new Error('down'))
    await expect(enablePush('B')).rejects.toThrow('down')
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('does nothing where push is unavailable', async () => {
    expect(await enablePush('A')).toBe('unsupported')
  })
})

describe('syncPushWho', () => {
  it('re-labels an existing subscription when the phone switches user', async () => {
    installPush({ existing: true, permission: 'granted' })
    await syncPushWho('A')
    expect(backend.savePushSubscription).toHaveBeenCalledWith(expect.objectContaining({ who: 'A' }))
  })

  it('is a no-op without a subscription, and never throws', async () => {
    installPush({ existing: false, permission: 'granted' })
    await syncPushWho('A')
    expect(backend.savePushSubscription).not.toHaveBeenCalled()
    vi.mocked(backend.savePushSubscription).mockRejectedValueOnce(new Error('down'))
    installPush({ existing: true, permission: 'granted' })
    await expect(syncPushWho('B')).resolves.toBeUndefined()
  })
})
