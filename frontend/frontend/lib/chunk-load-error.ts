'use client'

/** Erkennt typische Next-Chunk-Ladefehler (stale SW, alter Build, HMR). */
export function isChunkLoadErrorMessage(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('loading chunk') ||
    m.includes('chunkloaderror') ||
    m.includes('failed to fetch dynamically imported module') ||
    m.includes('_next/static/chunks')
  )
}

export function isChunkLoadErrorUnknown(reason: unknown): boolean {
  if (reason instanceof Error) return isChunkLoadErrorMessage(reason.message)
  return isChunkLoadErrorMessage(String(reason ?? ''))
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
