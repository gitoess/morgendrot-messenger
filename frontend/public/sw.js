/**
 * Morgendrot PWA – Service Worker (minimal, stabil)
 *
 * - `/_next/static/`: **Network-first** (verhindert „failed to load chunk“ nach neuem Build + altem SW-Cache). Offline: Cache-Fallback.
 * - `/handbook/*.md`: Cache-first (Handbuch, offline nach erstem Abruf / Install).
 * - Navigation (document): bei Netzfehler Fallback auf zuvor gecachte Route **`/offline`** (Install/Precache).
 * - Kein Cache für /api/* : Backend bleibt „online first“; ohne Netz keine API.
 * - Erste App-Session ohne Netz: begrenzt (Handbuch nur wenn precache oder vorher geladen).
 *
 * VERSION erhöhen bei Änderungen an Caching (Clients holen neue sw.js).
 */
const VERSION = 'morgendrot-sw-14'
const STATIC_CACHE = `next-static-${VERSION}`
const HANDBOOK_CACHE = `handbook-${VERSION}`
const OFFLINE_SHELL_CACHE = `pwa-offline-${VERSION}`
/** Muss zu scripts/sync-pwa-handbook.mjs und frontend/public/handbook/ passen */
const HANDBOOK_URLS = [
  '/handbook/API-EINSATZ-ROLE-TEMPLATES.md',
  '/handbook/BOSS-ORIENTIERUNG.md',
  '/handbook/DASHBOARD-ERSTE-SCHRITTE.md',
  '/handbook/DASHBOARD-PORT-UND-OBERFLAECHE.md',
  '/handbook/ONBOARDING-WALLET-UX-SPEC.md',
  '/handbook/RECOVERY-PHRASE-BACKUP.md',
  '/handbook/PWA-HANDBUCH-OFFLINE.md',
  '/handbook/NOTFALL-PURGE-MESSENGER.md',
  '/handbook/VAULT-STEGANOGRAPHIE-TRAGERBILD-ZIELBILD.md',
  '/handbook/EINSATZ-VAULT-PURGE-PDF-REDUNDANZ-ZIELBILD.md',
  '/handbook/VAULT-TRAEGERBILD-EINSATZ-ORGANISATION.md',
  '/handbook/ROLLENWECHSEL-TEAM-EINSATZ.md',
  '/handbook/MESSENGER-CHAT-HANDBUCH.md',
  '/handbook/VAULT-EINRICHTEN.md',
  '/handbook/VAULT-BEGRIFFE-MESSAGEN-vs-TRESOR.md',
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
      try {
        const offlineCache = await caches.open(OFFLINE_SHELL_CACHE)
        const offlineRes = await fetch('/offline')
        if (offlineRes.ok) await offlineCache.put('/offline', offlineRes.clone())
      } catch {
        /* /offline nicht erreichbar beim Install — überspringen */
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
              (k.startsWith('handbook-') && k !== HANDBOOK_CACHE) ||
              (k.startsWith('pwa-offline-') && k !== OFFLINE_SHELL_CACHE)
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
      event.respondWith(staticNetworkFirst(req))
    } else if (url.pathname.startsWith('/handbook/') && url.pathname.endsWith('.md')) {
      event.respondWith(handbookCacheFirst(req))
    } else if (req.mode === 'navigate') {
      event.respondWith(navigateOfflineFallback(req))
    }
  } catch {
    /* ignore */
  }
})

/**
 * Next-Build-Chunks: zuerst Netzwerk (immer passende Hashes nach `next build`).
 * Nur bei Netzfehler Cache — vermeidet „Loading chunk … failed“ nach Deploy/Rebuild bei alter gecachter HTML/Chunk-Kombination.
 */
async function staticNetworkFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  try {
    const res = await fetch(request)
    if (res.ok) await cache.put(request, res.clone())
    return res
  } catch {
    const hit = await cache.match(request)
    if (hit) return hit
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
  }
}

async function navigateOfflineFallback(request) {
  try {
    const res = await fetch(request)
    if (res.ok || res.status === 304) return res
  } catch {
    /* Netzwerkfehler — Fallback */
  }
  const shell = await caches.open(OFFLINE_SHELL_CACHE).then((c) => c.match('/offline'))
  if (shell) return shell
  return new Response(
    '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title></head><body style="font-family:system-ui,sans-serif;padding:1rem;max-width:28rem;margin:auto;line-height:1.45">' +
      '<h1 style="font-size:1.1rem">Keine Netzverbindung</h1>' +
      '<p>Wenn die installierte App <strong>http://127.0.0.1:3341</strong> nutzt: <strong>127.0.0.1</strong> ist <em>dieses</em> Gerät. Mit USB-<code>adb reverse</code> ging der Verkehr zum PC — <strong>ohne Kabel</strong> lauscht hier niemand. Lösung: PWA über die <strong>WLAN-IP des PCs</strong> (z. B. <code>http://192.168.…:3341</code>) installieren <em>oder</em> eine gehostete URL; Zielbild: Handy-first / direkt IOTA siehe Projekt-Architektur-Doku.</p>' +
      '<p style="font-size:0.9rem;opacity:.85">Übergang: Viele Flows nutzen noch <code>/api</code> auf der Basis — bis der Client-Pfad weiter ausgebaut ist.</p>' +
      '</body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
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
