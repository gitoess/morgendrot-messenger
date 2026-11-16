/**
 * Zwei-/Drei-Ton-Chime bei neuem Inbox-Eingang (Tab offen).
 * Bewusst anders als UI-Klick (kurzer Triangle-Piep 380–660 Hz) — Glocken-Charakter, tiefer/länger.
 * Kein OS-Push — das bleibt T53 / H.6f.
 */

import {
  readIncomingToneChannelEnabled,
  readIncomingToneMasterEnabled,
  type IncomingToneChannel,
} from '@/frontend/lib/incoming-message-tone-prefs'
import { readSoundFeedbackVolume } from '@/frontend/lib/ui-feedback-prefs'
import type { Message } from '@/frontend/lib/types'

/** Frequenzen bewusst außerhalb der Klick-Töne (soft 380 / select 520 / confirm 660 / hover 440). */
type ChimeNote = { freq: number; startMs: number; durMs: number }

const CHIMES: Record<IncomingToneChannel, { notes: ChimeNote[]; gain: number }> = {
  /** 1:1 — weiches „Ding–Dong“ (Eb4 → Bb4). */
  dialog: {
    gain: 0.16,
    notes: [
      { freq: 311, startMs: 0, durMs: 220 },
      { freq: 466, startMs: 160, durMs: 280 },
    ],
  },
  /** Gruppe — tiefer Dreiklang-Anflug (B3 → D4 → F#4). */
  group: {
    gain: 0.15,
    notes: [
      { freq: 247, startMs: 0, durMs: 180 },
      { freq: 294, startMs: 120, durMs: 180 },
      { freq: 370, startMs: 240, durMs: 260 },
    ],
  },
  /** Pinnwand — helleres Doppel-Glockchen (F5 → A5), länger als Klick. */
  pinnwand: {
    gain: 0.14,
    notes: [
      { freq: 698, startMs: 0, durMs: 160 },
      { freq: 880, startMs: 130, durMs: 240 },
    ],
  },
}

/** Priorität wenn ein Poll mehrere Novel-Typen liefert — ein Ton, nicht ein Akkord. */
const PRIORITY: IncomingToneChannel[] = ['group', 'pinnwand', 'dialog']

let lastPlayAt = 0
const MIN_GAP_MS = 1200

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
    const chime = CHIMES[ch]
    const ctx = getAudioContext()
    if (!ctx) return
    const start = () => {
      const t0 = ctx.currentTime
      const peak = Math.max(0.015, chime.gain * (volPct / 100))
      for (const note of chime.notes) {
        const osc = ctx.createOscillator()
        const partial = ctx.createOscillator()
        const gain = ctx.createGain()
        const noteStart = t0 + note.startMs / 1000
        const noteEnd = noteStart + note.durMs / 1000
        /** Sine + leichte Quinte = Glocke; Klick nutzt Triangle + Pitch-Drop. */
        osc.type = 'sine'
        partial.type = 'sine'
        osc.frequency.setValueAtTime(note.freq, noteStart)
        partial.frequency.setValueAtTime(note.freq * 1.5, noteStart)
        gain.gain.setValueAtTime(0, noteStart)
        gain.gain.linearRampToValueAtTime(peak, noteStart + 0.018)
        gain.gain.exponentialRampToValueAtTime(0.001, noteEnd)
        osc.connect(gain)
        partial.connect(gain)
        gain.connect(ctx.destination)
        osc.start(noteStart)
        partial.start(noteStart)
        osc.stop(noteEnd + 0.03)
        partial.stop(noteEnd + 0.03)
        osc.onended = () => {
          try {
            osc.disconnect()
            partial.disconnect()
            gain.disconnect()
          } catch {
            /* ignore */
          }
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
