'use client'

/** Erkennt typische Next-Chunk-Ladefehler (stale SW, alter Build, HMR). */
export function isChunkLoadErrorMessage(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('loading chunk') ||
    m.includes('chunkloaderror') ||
    m.includes('failed to fetch dynamically imported module') ||
    m.includes('_next/static/chunks') ||
    (m.includes('missing:') && m.includes('chunks'))
  )
}

function resourceLoadLabelFromEvent(ev: Event): string {
  const t = ev.target
  if (t instanceof HTMLScriptElement && t.src) return t.src
  if (t instanceof HTMLLinkElement && t.href) return t.href
  if (typeof ErrorEvent !== 'undefined' && ev instanceof ErrorEvent && ev.message) return ev.message
  return ''
}

/** Webpack/Next lehnen manchmal mit DOM-Event statt Error ab → Next zeigt „[object Event]“. */
export function isResourceLoadRejection(reason: unknown): boolean {
  if (typeof Event === 'undefined') return false
  if (!(reason instanceof Event) || reason.type !== 'error') return false
  const label = resourceLoadLabelFromEvent(reason)
  if (!label) return false
  return isChunkLoadErrorMessage(label) || /\/_next\/static\/chunks\//i.test(label)
}

export function isChunkLoadErrorUnknown(reason: unknown): boolean {
  if (reason instanceof Error) return isChunkLoadErrorMessage(reason.message)
  if (isResourceLoadRejection(reason)) return true
  if (typeof ErrorEvent !== 'undefined' && reason instanceof ErrorEvent) {
    const msg = reason.message || resourceLoadLabelFromEvent(reason)
    if (msg && isChunkLoadErrorMessage(msg)) return true
  }
  const asString = String(reason ?? '')
  if (asString === '[object Event]') return true
  return isChunkLoadErrorMessage(asString)
}

const CHUNK_RELOAD_GUARD_KEY = 'morgendrot.chunkReloadAttempt'
const CHUNK_RELOAD_GUARD_MS = 15_000

function shouldAttemptChunkHardReload(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const last = sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)
    const now = Date.now()
    if (last && now - Number(last) < CHUNK_RELOAD_GUARD_MS) return false
    sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, String(now))
    return true
  } catch {
    return true
  }
}

/** Einmaliger Hard-Reload bei stale Next-Chunks (HMR, SW, Deploy). */
export function importWithChunkRecovery<T>(loader: () => Promise<T>): Promise<T> {
  return loader().catch((err) => {
    if (!isChunkLoadErrorUnknown(err)) throw err
    if (typeof window !== 'undefined' && shouldAttemptChunkHardReload()) {
      void hardReloadAfterChunkFailure()
      return new Promise<T>(() => {})
    }
    throw err
  })
}

/** SW + Caches leeren und zur Startseite (Recovery nach Deploy/APK-Update). */
export async function hardReloadAfterChunkFailure(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    // Recovery best effort.
  }
  window.location.replace(`/?reload=${Date.now()}`)
}
