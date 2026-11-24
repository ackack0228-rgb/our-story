import { backend, type PushSubscriptionRow } from './supabaseBackend'
import type { Who } from '../../supabase/functions/_shared/rules'

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

export function subscriptionRow(json: PushSubscriptionJSON, who: Who, now: number): PushSubscriptionRow {
  const { endpoint, keys } = json
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw new Error('incomplete push subscription')
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth, who, created_at: now }
}

// iPhones only expose PushManager to web apps opened from the home screen icon; in a Safari tab
// the service worker exists but push doesn't — that's the "add to home screen first" case.
function availability(): 'ok' | 'needs-install' | 'unsupported' {
  if (!('serviceWorker' in navigator)) return 'unsupported'
  if (!('PushManager' in window) || !('Notification' in window)) {
    return 'standalone' in navigator ? 'needs-install' : 'unsupported'
  }
  return 'ok'
}

export async function getPushState(): Promise<PushState> {
  const available = availability()
  if (available !== 'ok') return available
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'
  return (await currentSubscription()) ? 'on' : 'off'
}

// getRegistration rather than serviceWorker.ready: ready never settles when the service worker
// failed to register, which would leave the settings screen with no notification section at all.
async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration()
  return registration ? registration.pushManager.getSubscription() : null
}

// Must be called from a tap: iOS only shows the permission prompt in response to a user gesture.
export async function enablePush(who: Who): Promise<PushState> {
  const available = availability()
  if (available !== 'ok') return available
  const permission = await Notification.requestPermission()
  // Closing the prompt without choosing leaves it askable, so the button has to stay.
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'
  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
    }))
  try {
    await backend.savePushSubscription(subscriptionRow(subscription.toJSON(), who, Date.now()))
  } catch (error) {
    // "On" is read from the browser's subscription. One the server never heard of would show as on
    // forever while no notification could reach this phone, so it is dropped and the button returns.
    await subscription.unsubscribe().catch(() => {})
    throw error
  }
  return 'on'
}

// Keeps "whose phone is this" right after 누구세요? / 사용자 바꾸기. Best effort — a failure here
// must never get in the way of using the app.
export async function syncPushWho(who: Who): Promise<void> {
  try {
    if ((await getPushState()) !== 'on') return
    const subscription = await currentSubscription()
    if (subscription) await backend.savePushSubscription(subscriptionRow(subscription.toJSON(), who, Date.now()))
  } catch {
    // ignore
  }
}
