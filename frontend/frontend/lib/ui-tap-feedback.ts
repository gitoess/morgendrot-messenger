/**
 * Klick-Ton + Wii-ähnlicher Hover-Magnet (Scale/Lift/Glow).
 * Prefs: `ui-feedback-prefs.ts`. Fail-silent.
 */

import {
  readMagnetFeedbackEnabled,
  readSoundFeedbackEnabled,
  UI_FEEDBACK_PREFS_CHANGED,
} from '@/frontend/lib/ui-feedback-prefs'

let sharedCtx: AudioContext | null = null
let installed = false
let lastClickAt = 0
let lastHoverToneAt = 0
let hoverTarget: Element | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!sharedCtx) sharedCtx = new AC()
  return sharedCtx
}

export type TapFeedbackKind = 'select' | 'confirm' | 'soft' | 'hover'

const TONES: Record<TapFeedbackKind, { freq: number; durMs: number; gain: number }> = {
  select: { freq: 520, durMs: 85, gain: 0.1 },
  confirm: { freq: 660, durMs: 100, gain: 0.11 },
  soft: { freq: 380, durMs: 55, gain: 0.05 },
  hover: { freq: 440, durMs: 45, gain: 0.035 },
}

export function playTapClick(kind: TapFeedbackKind = 'select'): void {
  try {
    if (!readSoundFeedbackEnabled()) return
    const ctx = getAudioContext()
    if (!ctx) return
    void ctx.resume().catch(() => undefined)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const { freq, durMs, gain: peak } = TONES[kind]
    const now = ctx.currentTime
    osc.type = kind === 'hover' ? 'sine' : 'triangle'
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq * (kind === 'hover' ? 1.08 : 0.75), now + durMs / 1000)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + durMs / 1000 + 0.02)
  } catch {
    // ignore
  }
}

export function pulseHaptic(_pattern: number | number[] = 18): void {
  // Desktop: Magnet ersetzt Vibration.
}

export function tapSelectFeedback(): void {
  playTapClick('select')
}

export function tapConfirmFeedback(): void {
  playTapClick('confirm')
}

const TAP_SELECTOR =
  'button, [role="button"], [data-slot="button"], a[href], summary, [data-tap-feedback], input[type="button"], input[type="submit"], input[type="reset"]'

function isInteractiveTapTarget(el: Element | null): Element | null {
  if (!el || !(el instanceof Element)) return null
  const hit = el.closest(TAP_SELECTOR)
  if (!hit) return null
  if (hit.hasAttribute('disabled') || hit.getAttribute('aria-disabled') === 'true') return null
  if (hit.getAttribute('data-no-tap-feedback') === 'true') return null
  return hit
}

/** Sync HTML-Flag für CSS-Hover (zuverlässiger als nur JS-Klasse). */
export function syncUiMagnetDomFlag(): void {
  if (typeof document === 'undefined') return
  const on = readMagnetFeedbackEnabled()
  document.documentElement.dataset.uiMagnet = on ? '1' : '0'
  if (!on) clearHoverMagnet()
}

function clearHoverMagnet(): void {
  if (hoverTarget instanceof HTMLElement) {
    hoverTarget.classList.remove('ui-magnet-hover')
  }
  hoverTarget = null
}

function applyHoverMagnet(el: Element): void {
  if (!readMagnetFeedbackEnabled()) return
  if (!(el instanceof HTMLElement)) return
  if (hoverTarget === el) return
  clearHoverMagnet()
  hoverTarget = el
  el.classList.add('ui-magnet-hover')
  const now = Date.now()
  if (now - lastHoverToneAt > 180) {
    lastHoverToneAt = now
    playTapClick('hover')
  }
}

export function ensureUiTapFeedbackInstalled(): void {
  if (typeof window === 'undefined' || installed) return
  installed = true
  syncUiMagnetDomFlag()
  window.addEventListener(UI_FEEDBACK_PREFS_CHANGED, () => syncUiMagnetDomFlag())

  window.addEventListener(
    'pointerover',
    (e) => {
      const hit = isInteractiveTapTarget(e.target as Element | null)
      if (!hit) {
        clearHoverMagnet()
        return
      }
      applyHoverMagnet(hit)
    },
    true
  )

  window.addEventListener(
    'pointerout',
    (e) => {
      if (!hoverTarget) return
      const related = (e as PointerEvent).relatedTarget as Element | null
      if (related && hoverTarget.contains(related)) return
      if (related && isInteractiveTapTarget(related) === hoverTarget) return
      clearHoverMagnet()
    },
    true
  )

  window.addEventListener(
    'click',
    (e) => {
      if (!(e instanceof MouseEvent) || e.button !== 0) return
      if (!isInteractiveTapTarget(e.target as Element | null)) return
      const now = Date.now()
      if (now - lastClickAt < 280) return
      lastClickAt = now
      tapSelectFeedback()
    },
    true
  )

  window.addEventListener(
    'dblclick',
    (e) => {
      if (!isInteractiveTapTarget(e.target as Element | null)) return
      lastClickAt = Date.now()
      tapConfirmFeedback()
    },
    true
  )
}
