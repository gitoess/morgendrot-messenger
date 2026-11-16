/**
 * Kurzer WebAudio-Piep bei neuem Inbox-Eingang (Tab offen).
 * Kein OS-Push — das bleibt T53 / H.6f.
 */

import {
  readIncomingToneChannelEnabled,
  readIncomingToneMasterEnabled,
  type IncomingToneChannel,
} from '@/frontend/lib/incoming-message-tone-prefs'
import { readSoundFeedbackVolume } from '@/frontend/lib/ui-feedback-prefs'
import type { Message } from '@/frontend/lib/types'

const TONES: Record<IncomingToneChannel, { freq: number; durMs: number; gain: number }> = {
  dialog: { freq: 660, durMs: 110, gain: 0.2 },
  group: { freq: 440, durMs: 140, gain: 0.22 },
  pinnwand: { freq: 880, durMs: 90, gain: 0.18 },
}

/** Priorität wenn ein Poll mehrere Novel-Typen liefert — ein Ton, nicht ein Akkord. */
const PRIORITY: IncomingToneChannel[] = ['group', 'pinnwand', 'dialog']

let lastPlayAt = 0
const MIN_GAP_MS = 900

export function classifyIncomingToneChannel(
  msg: Pick<Message, 'pinnwandPost' | 'chainPurgeKind'>
): IncomingToneChannel {
  if (msg.pinnwandPost) return 'pinnwand'
  if (msg.chainPurgeKind === 'team-broadcast') return 'group'
  return 'dialog'
}

export function pickIncomingToneChannel(
  messages: Array<Pick<Message, 'pinnwandPost' | 'chainPurgeKind' | 'from'>>,
  myAddress: string
): IncomingToneChannel | null {
  const my = myAddress.trim().toLowerCase()
  const kinds = new Set<IncomingToneChannel>()
  for (const m of messages) {
    if (my && m.from.trim().toLowerCase() === my) continue
    kinds.add(classifyIncomingToneChannel(m))
  }
  if (kinds.size === 0) return null
  for (const p of PRIORITY) {
    if (kinds.has(p)) return p
  }
  return null
}

export function shouldPlayIncomingTone(ch: IncomingToneChannel, opts?: { documentHidden?: boolean }): boolean {
  if (!readIncomingToneMasterEnabled()) return false
  if (!readIncomingToneChannelEnabled(ch)) return false
  if (opts?.documentHidden ?? (typeof document !== 'undefined' && document.hidden)) return false
  return true
}

let sharedCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!sharedCtx) sharedCtx = new AC()
  return sharedCtx
}

/** Probe-Ton aus Einstellungen (User-Geste → `force`). */
export function playIncomingMessageTone(ch: IncomingToneChannel, opts?: { force?: boolean }): void {
  try {
    if (!opts?.force && !shouldPlayIncomingTone(ch, { documentHidden: false })) return
    const volPct = readSoundFeedbackVolume()
    if (volPct <= 0) return
    const now = Date.now()
    if (!opts?.force && now - lastPlayAt < MIN_GAP_MS) return
    lastPlayAt = now
    const tone = TONES[ch]
    const ctx = getAudioContext()
    if (!ctx) return
    const start = () => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const t0 = ctx.currentTime
      const peak = Math.max(0.02, tone.gain * (volPct / 100))
      osc.type = 'sine'
      osc.frequency.value = tone.freq
      gain.gain.setValueAtTime(peak, t0)
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + tone.durMs / 1000)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + tone.durMs / 1000 + 0.02)
      osc.onended = () => {
        try {
          osc.disconnect()
          gain.disconnect()
        } catch {
          /* ignore */
        }
      }
    }
    if (ctx.state === 'running') start()
    else {
      void ctx.resume().then(() => {
        if (ctx.state === 'running') start()
      }).catch(() => undefined)
    }
  } catch {
    /* ignore */
  }
}

/** Nach Poll: höchstens ein Ton für die Novel-Menge. */
export function notifyIncomingMessagesTone(
  novel: Array<Pick<Message, 'pinnwandPost' | 'chainPurgeKind' | 'from'>>,
  myAddress: string
): void {
  const ch = pickIncomingToneChannel(novel, myAddress)
  if (!ch) return
  if (!shouldPlayIncomingTone(ch)) return
  playIncomingMessageTone(ch)
}
