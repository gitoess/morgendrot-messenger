'use client'

/** Radix-Attribute / pointer-events — ohne native-body-lock (kein Zirkelimport). */
export function clearStuckRadixBodyLockAttrs(): void {
  if (typeof document === 'undefined') return
  if (document.body.style.position === 'fixed') {
    const scrollY = Math.abs(parseInt(document.body.style.top || '0', 10) || 0)
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.width = ''
    document.body.style.overflow = ''
    if (scrollY > 0) window.scrollTo(0, scrollY)
  }
  for (const el of [document.body, document.documentElement]) {
    el.style.pointerEvents = ''
    el.style.removeProperty('pointer-events')
    el.removeAttribute('data-scroll-locked')
    el.removeAttribute('data-radix-scroll-lock')
    el.removeAttribute('data-aria-hidden')
  }
}
