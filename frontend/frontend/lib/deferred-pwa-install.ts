/**
 * Shared beforeinstallprompt — Dashboard + Einstellungen teilen ein Deferred-Prompt.
 */

export type DeferredPwaPrompt = {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const CHANGED = 'morgendrot:deferred-pwa-install'

let deferred: DeferredPwaPrompt | null = null
let listenCount = 0
let onBeforeInstall: ((e: Event) => void) | null = null

function emit() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(CHANGED))
}

export function getDeferredPwaInstall(): DeferredPwaPrompt | null {
  return deferred
}

export function clearDeferredPwaInstall(): void {
  deferred = null
  emit()
}

/** Refcounted Fenster-Listener — mehrere UI-Karten teilen denselben Prompt. */
export function ensureDeferredPwaInstallListener(): () => void {
  if (typeof window === 'undefined') return () => undefined
  if (!onBeforeInstall) {
    onBeforeInstall = (e: Event) => {
      e.preventDefault()
      deferred = e as unknown as DeferredPwaPrompt
      emit()
    }
  }
  if (listenCount === 0) {
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
  }
  listenCount += 1
  return () => {
    listenCount = Math.max(0, listenCount - 1)
    if (listenCount === 0 && onBeforeInstall) {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    }
  }
}

export function subscribeDeferredPwaInstall(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener(CHANGED, cb)
  return () => window.removeEventListener(CHANGED, cb)
}

export async function promptDeferredPwaInstall(): Promise<boolean> {
  const p = deferred
  if (!p) return false
  try {
    await p.prompt()
    await p.userChoice
    return true
  } finally {
    clearDeferredPwaInstall()
  }
}
