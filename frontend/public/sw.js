/**
 * Morgendrot PWA – Service Worker (minimal, stabil)
 *
 * - Cached Same-Origin: /_next/static/ (JS/CSS-Chunks) + /handbook/*.md (Handbuch, offline nach erstem Abruf / Install).
 * - Kein Cache für /api/* : Backend bleibt „online first“; ohne Netz keine API.
 * - Erste App-Session ohne Netz: begrenzt (Handbuch nur wenn precache oder vorher geladen).
 *
 * VERSION erhöhen bei Änderungen an Caching (Clients holen neue sw.js).
 */
const VERSION = 'morgendrot-sw-3'
const STATIC_CACHE = `next-static-${VERSION}`
const HANDBOOK_CACHE = `handbook-${VERSION}`
/** Muss zu scripts/sync-pwa-handbook.mjs und frontend/public/handbook/ passen */
const HANDBOOK_URLS = [
  '/handbook/BOSS-ORIENTIERUNG.md',
  '/handbook/PWA-HANDBUCH-OFFLINE.md',
  '/handbook/NOTFALL-PURGE-MESSENGER.md',
  '/handbook/VAULT-STEGANOGRAPHIE-TRAGERBILD-ZIELBILD.md',
  '/handbook/EINSATZ-VAULT-PURGE-PDF-REDUNDANZ-ZIELBILD.md',
  '/handbook/VAULT-TRAEGERBILD-EINSATZ-ORGANISATION.md',
  '/handbook/ROLLENWECHSEL-TEAM-EINSATZ.md',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(HANDBOOK_CACHE)
        await Promise.all(
          HANDBOOK_URLS.map((url) =>
            fetch(url).then((res) => {
              if (res.ok) return cache.put(url, res)
            })
          )
        )
      } catch {
        /* Handbuch-Dateien fehlen im Build — überspringen */
      }
    })()
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter(
            (k) =>
              (k.startsWith('next-static-') && k !== STATIC_CACHE) ||
              (k.startsWith('handbook-') && k !== HANDBOOK_CACHE)
          )
          .map((k) => caches.delete(k))
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
    } else if (url.pathname.startsWith('/handbook/') && url.pathname.endsWith('.md')) {
      event.respondWith(handbookCacheFirst(req))
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

async function handbookCacheFirst(request) {
  const cache = await caches.open(HANDBOOK_CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  try {
    const res = await fetch(request)
    if (res.ok) cache.put(request, res.clone())
    return res
  } catch {
    const fallback = await cache.match(request)
    if (fallback) return fallback
    return new Response('Handbuch offline nicht verfügbar — einmal mit Netz öffnen.', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}
