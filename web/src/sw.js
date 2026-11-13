/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'

// Same behaviour the generated worker had (precache, SPA fallback, font
// caching, auto-update) plus Web Push for alerts while the app is closed.

self.skipWaiting()
clientsClaim()

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api/, /^\/socket\.io/],
  }),
)

registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-stylesheets',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)

// ---- Web Push ----

// Apple's push services require every push to show a notification, so we
// never suppress there. Elsewhere, skip the system toast while the user is
// looking at the app: the bell and live socket already show it in-page.
function isApple() {
  const ua = self.navigator?.userAgent ?? ''
  return /iPhone|iPad|iPod|Macintosh/.test(ua) && !/Chrome|Chromium|Edg|Firefox|FxiOS|CriOS/.test(ua)
}

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'DesignTree', body: event.data?.text() ?? '' }
  }
  const title = data.title || 'DesignTree'

  event.waitUntil(
    (async () => {
      if (!isApple()) {
        const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        if (wins.some((c) => c.visibilityState === 'visible' && c.focused)) return
      }
      await self.registration.showNotification(title, {
        body: data.body || '',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        // Same id replaces rather than stacks if a push is delivered twice.
        tag: data.id || undefined,
        data: { id: data.id, link: data.link },
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data?.link
  const id = event.notification.data?.id

  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = wins.find((c) => 'focus' in c)
      if (open) {
        // The page knows the signed-in role, so it resolves the route itself
        // (same deep-link map the bell uses) and marks the item read.
        await open.focus()
        open.postMessage({ type: 'push-click', id, link })
        return
      }
      // App closed: cold-start with the link in the URL; NotifBell consumes it.
      const qs = new URLSearchParams()
      if (link?.view) qs.set('nview', link.view)
      if (link?.id) qs.set('nid', link.id)
      if (id) qs.set('nref', id)
      const q = qs.toString()
      await self.clients.openWindow(q ? `/?${q}` : '/')
    })(),
  )
})
