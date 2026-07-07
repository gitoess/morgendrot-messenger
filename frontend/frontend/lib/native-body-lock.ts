'use client'

import { clearStuckRadixBodyLockAttrs } from '@/frontend/lib/release-modal-pointer-events-attrs'

let bodyLockDepth = 0
let bodyLockScrollY = 0
let bodyLockPrev = { overflow: '', position: '', top: '', width: '' }
let bodyTouchBlocker: ((e: TouchEvent) => void) | null = null

const NATIVE_MODAL_PANEL_ATTR = 'data-morgendrot-native-modal-panel'

export function acquireNativeBodyLock(): void {
  if (typeof document === 'undefined') return
  if (bodyLockDepth === 0) {
    clearStuckRadixBodyLockAttrs()
    bodyLockScrollY = window.scrollY
    bodyLockPrev = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    }
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${bodyLockScrollY}px`
    document.body.style.width = '100%'
    bodyTouchBlocker = (e: TouchEvent) => {
      const panel = document.querySelector(`[${NATIVE_MODAL_PANEL_ATTR}]`)
      if (panel?.contains(e.target as Node)) return
      e.preventDefault()
    }
    document.addEventListener('touchmove', bodyTouchBlocker, { passive: false, capture: true })
  }
  bodyLockDepth += 1
}

export function releaseNativeBodyLock(): void {
  if (typeof document === 'undefined') return
  if (bodyLockDepth <= 0) return
  bodyLockDepth -= 1
  if (bodyLockDepth > 0) return
  if (bodyTouchBlocker) {
    document.removeEventListener('touchmove', bodyTouchBlocker, { capture: true })
    bodyTouchBlocker = null
  }
  document.body.style.overflow = bodyLockPrev.overflow
  document.body.style.position = bodyLockPrev.position
  document.body.style.top = bodyLockPrev.top
  document.body.style.width = bodyLockPrev.width
  window.scrollTo(0, bodyLockScrollY)
}

/** Nach Tresor-Entsperren: hängenden Scroll-Lock sofort lösen. */
export function forceReleaseNativeBodyLock(): void {
  bodyLockDepth = 0
  if (typeof document === 'undefined') return
  if (bodyTouchBlocker) {
    document.removeEventListener('touchmove', bodyTouchBlocker, { capture: true })
    bodyTouchBlocker = null
  }
  const scrollY =
    document.body.style.position === 'fixed'
      ? Math.abs(parseInt(document.body.style.top || '0', 10) || 0)
      : bodyLockScrollY
  document.body.style.overflow = ''
  document.body.style.position = ''
  document.body.style.top = ''
  document.body.style.width = ''
  if (scrollY > 0) window.scrollTo(0, scrollY)
  clearStuckRadixBodyLockAttrs()
}
