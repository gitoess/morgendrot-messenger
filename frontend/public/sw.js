/**
 * Morgendrot PWA – Service Worker (minimal, stabil)
 *
 * - Cached nur Same-Origin Requests unter /_next/static/ (JS/CSS-Chunks nach erstem Laden).
 * - Kein Cache für /api/* : Backend bleibt „online first“; ohne Netz keine API.
 * - Erste Ladung ohne Netz: nicht unterstützt (Next braucht Server/Build).
 *
 * Version erhöhen, wenn sich Caching-Strategie ändert (Clients holen neue sw.js).
 */
const VERSION = 'morgendrot-sw-1'
const STATIC_CACHE = `next-static-${VERSION}`

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => k.startsWith('next-static-') && k !== STATIC_CACHE).map((k) => caches.delete(k))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  try {
    const url = new URL(req.url)
    if (url.origin !== self.location.origin) return
    if (url.pathname.startsWith('/_next/static/')) {
      event.respondWith(staticCacheFirst(req))
    }
  } catch {
    /* ignore */
  }
})

async function staticCacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  try {
    const res = await fetch(request)
    if (res.ok) cache.put(request, res.clone())
    return res
  } catch {
    return (
      (await cache.match(request)) ||
      new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
    )
  }
}
