// Basher Service Worker — Push Notifications
const CACHE = 'basher-v1'

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim())
})

// Recebe push do servidor
self.addEventListener('push', e => {
  if (!e.data) return
  const d = e.data.json()
  e.waitUntil(
    self.registration.showNotification(d.title, {
      body:  d.body  ?? '',
      icon:  d.icon  ?? '/icon.svg',
      badge: '/icon.svg',
      data:  d.data  ?? {},
      vibrate: [100, 50, 100],
    })
  )
})

// Clique na notificação — abre o app
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url ?? '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const found = list.find(c => c.url.includes(self.location.origin))
      if (found) return found.focus()
      return clients.openWindow(url)
    })
  )
})
