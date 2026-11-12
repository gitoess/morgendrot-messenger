/**
 * Klick-Feedback: deutlicher Ton + Vibration (Mobil) + leichter „Magnet“-Scale an Buttons.
 * Fail-silent — nie UX blockieren.
 */

let sharedCtx: AudioContext | null = null
let installed = false
let lastClickAt = 0

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
  soft: { freq: 360, durMs: 70, gain: 0.06 },
}

export function playTapClick(kind: TapFeedbackKind = 'select'): void {
  try {
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

export function pulseHaptic(pattern: number | number[] = 18): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern)
    }
  } catch {
    // ignore
  }
}

/** Klick-Ton + spürbarer Haptic-Puls. */
export function tapSelectFeedback(): void {
  playTapClick('select')
  pulseHaptic([14, 30, 18])
}

export function tapConfirmFeedback(): void {
  playTapClick('confirm')
  pulseHaptic([16, 40, 20, 30, 16])
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

/** Einmalig: Klick + Doppelklick → Ton/Haptik für Buttons und klickbare Controls. */
export function ensureUiTapFeedbackInstalled(): void {
  if (typeof window === 'undefined' || installed) return
  installed = true

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
