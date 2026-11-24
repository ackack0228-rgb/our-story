// Only handles notifications. No offline cache: without the network there is no data to show anyway.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    // A push we can't parse still has to show something — iOS revokes silent subscriptions.
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || '우리의 이야기', {
      body: payload.body || '새 소식이 있어요',
      icon: '/icons/icon-192.png',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) =>
      windows.length > 0 ? windows[0].focus() : self.clients.openWindow('/'),
    ),
  )
})
