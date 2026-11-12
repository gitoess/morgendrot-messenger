/**
 * Klick-Ton + Wii-ähnlicher Hover-Magnet (Scale/Lift/Glow).
 * Prefs: `ui-feedback-prefs.ts`. Fail-silent.
 */

import {
  readMagnetFeedbackEnabled,
  readSoundFeedbackEnabled,
  readSoundFeedbackVolume,
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

/** Gains = Lautstärke bei Regler 100 %. */
const TONES: Record<TapFeedbackKind, { freq: number; durMs: number; gain: number }> = {
  select: { freq: 520, durMs: 85, gain: 0.22 },
  confirm: { freq: 660, durMs: 100, gain: 0.24 },
  soft: { freq: 380, durMs: 70, gain: 0.18 },
  hover: { freq: 440, durMs: 45, gain: 0.1 },
}

export function playTapClick(kind: TapFeedbackKind = 'select'): void {
  try {
    if (!readSoundFeedbackEnabled()) return
    const volPct = readSoundFeedbackVolume()
    if (volPct <= 0) return
    const ctx = getAudioContext()
    if (!ctx) return
    void ctx.resume().catch(() => undefined)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const { freq, durMs, gain: peak } = TONES[kind]
    // Linear + leicht angehoben: 50 % soll klar leiser klingen als 100 %.
    const scaled = Math.max(0.001, peak * (volPct / 100))
    const now = ctx.currentTime
    const end = now + durMs / 1000
    osc.type = kind === 'hover' ? 'sine' : 'triangle'
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq * (kind === 'hover' ? 1.08 : 0.75), end)
    // linearRamp: zuverlässiger hörbar als exponential bei leisen Pegeln
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(scaled, now + 0.012)
    gain.gain.linearRampToValueAtTime(0, end)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(end + 0.02)
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

export type UiToneKind = 'unlock' | 'success' | 'error'

/** Kurze Semantik-Töne (Login ok / Fehler) — kein Sound-Design-System. */
export function playUiTone(kind: UiToneKind): void {
  try {
    if (!readSoundFeedbackEnabled()) return
    const volPct = readSoundFeedbackVolume()
    if (volPct <= 0) return
    const ctx = getAudioContext()
    if (!ctx) return
    void ctx.resume().catch(() => undefined)
    const vol = volPct / 100
    const now = ctx.currentTime
    const notes =
      kind === 'unlock'
        ? [
            { f: 392, t: 0, d: 0.09, g: 0.16 },
            { f: 523, t: 0.1, d: 0.14, g: 0.18 },
          ]
        : kind === 'success'
          ? [
              { f: 523, t: 0, d: 0.08, g: 0.14 },
              { f: 659, t: 0.09, d: 0.12, g: 0.16 },
            ]
          : [
              { f: 220, t: 0, d: 0.12, g: 0.14 },
              { f: 165, t: 0.1, d: 0.16, g: 0.12 },
            ]
    for (const n of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const start = now + n.t
      const end = start + n.d
      const peak = Math.max(0.001, n.g * vol)
      osc.type = kind === 'error' ? 'sawtooth' : 'triangle'
      osc.frequency.setValueAtTime(n.f, start)
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(peak, start + 0.015)
      gain.gain.linearRampToValueAtTime(0, end)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(end + 0.02)
    }
  } catch {
    /* ignore */
  }
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
