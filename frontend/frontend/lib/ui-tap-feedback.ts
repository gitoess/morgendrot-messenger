/**
 * Klick-Feedback: optionaler Ton + leichter Hover-/Press-„Magnet“ (Scale).
 * Vibration bewusst optional/aus — Desktop ohne Vibrate; Widerstand reicht.
 * Fail-silent — nie UX blockieren.
 */

import {
  readMagnetFeedbackEnabled,
  readSoundFeedbackEnabled,
} from '@/frontend/lib/ui-feedback-prefs'

let sharedCtx: AudioContext | null = null
let installed = false
let lastClickAt = 0
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

export type TapFeedbackKind = 'select' | 'confirm' | 'soft'

const TONES: Record<TapFeedbackKind, { freq: number; durMs: number; gain: number }> = {
  select: { freq: 480, durMs: 90, gain: 0.09 },
  confirm: { freq: 620, durMs: 110, gain: 0.1 },
  soft: { freq: 360, durMs: 55, gain: 0.04 },
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
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.75, now + durMs / 1000)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + durMs / 1000 + 0.03)
  } catch {
    // ignore
  }
}

export function pulseHaptic(_pattern: number | number[] = 18): void {
  // Bewusst kein navigator.vibrate — oft wirkungslos/Desktop; Magnet-Scale ersetzt.
}

/** Klick-Ton (wenn an). */
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
}

/** Einmalig: Hover-Magnet + Klick-Ton für Buttons und klickbare Controls. */
export function ensureUiTapFeedbackInstalled(): void {
  if (typeof window === 'undefined' || installed) return
  installed = true

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
