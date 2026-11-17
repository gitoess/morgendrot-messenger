/**
 * Zwei-/Drei-Ton-Chime bei neuem Inbox-Eingang (Tab offen).
 * Bewusst anders als UI-Klick (kurzer Triangle-Piep 380–660 Hz) — Glocken-Charakter, tiefer/länger.
 * Nutzt denselben AudioContext wie Klack/Klick (`whenAudioRunning`) — sonst nur Probe in Einstellungen hörbar.
 * Kein OS-Push — das bleibt T53 / H.6f.
 */

import {
  readIncomingToneChannelEnabled,
  readIncomingToneMasterEnabled,
  type IncomingToneChannel,
} from '@/frontend/lib/incoming-message-tone-prefs'
import { readSoundFeedbackVolume } from '@/frontend/lib/ui-feedback-prefs'
import { isChatMuted } from '@/frontend/lib/inbox-chat-mute-prefs'
import { muteKeyForInboxMessage } from '@/frontend/lib/inbox-chat-mute-key'
import {
  isSharedAudioRunning,
  registerAudioPrimeListener,
  whenAudioRunning,
} from '@/frontend/lib/ui-tap-feedback'
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
/** Wenn Browser Audio noch sperrt: nach nächster User-Geste nachholen. */
let pendingIncomingChannel: IncomingToneChannel | null = null
let primeListenerInstalled = false

function ensurePendingToneFlush(): void {
  if (primeListenerInstalled || typeof window === 'undefined') return
  primeListenerInstalled = true
  registerAudioPrimeListener(() => {
    const ch = pendingIncomingChannel
    if (!ch) return
    if (!readIncomingToneMasterEnabled()) {
      pendingIncomingChannel = null
      return
    }
    pendingIncomingChannel = null
    const volPct = readSoundFeedbackVolume()
    if (volPct <= 0) return
    whenAudioRunning((ctx) => playChimeOnContext(ctx, ch, volPct))
  })
}

export function classifyIncomingToneChannel(
  msg: Pick<Message, 'pinnwandPost' | 'chainPurgeKind'>
): IncomingToneChannel {
  if (msg.pinnwandPost) return 'pinnwand'
  if (msg.chainPurgeKind === 'team-broadcast') return 'group'
  return 'dialog'
}

export function pickIncomingToneChannel(
  messages: Array<Pick<Message, 'pinnwandPost' | 'chainPurgeKind' | 'from' | 'recipient'>>,
  myAddress: string
): IncomingToneChannel | null {
  const my = myAddress.trim().toLowerCase()
  const kinds = new Set<IncomingToneChannel>()
  for (const m of messages) {
    if (my && m.from.trim().toLowerCase() === my) continue
    const muteKey = muteKeyForInboxMessage(m, myAddress)
    if (muteKey && isChatMuted(muteKey)) continue
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

function playChimeOnContext(ctx: AudioContext, ch: IncomingToneChannel, volPct: number): void {
  const chime = CHIMES[ch]
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

/** Probe-Ton aus Einstellungen (User-Geste → `force`). */
export function playIncomingMessageTone(ch: IncomingToneChannel, opts?: { force?: boolean }): void {
  try {
    ensurePendingToneFlush()
    if (!opts?.force && !shouldPlayIncomingTone(ch, { documentHidden: false })) return
    const volPct = readSoundFeedbackVolume()
    if (volPct <= 0) return
    const now = Date.now()
    if (!opts?.force && now - lastPlayAt < MIN_GAP_MS) return
    lastPlayAt = now
    if (!opts?.force && !isSharedAudioRunning()) {
      pendingIncomingChannel = ch
      whenAudioRunning((ctx) => {
        pendingIncomingChannel = null
        playChimeOnContext(ctx, ch, volPct)
      })
      return
    }
    pendingIncomingChannel = null
    whenAudioRunning((ctx) => playChimeOnContext(ctx, ch, volPct))
  } catch {
    /* ignore */
  }
}

/** Nach Poll / Journal-Merge: höchstens ein Ton für die Novel-Menge. */
export function notifyIncomingMessagesTone(
  novel: Array<Pick<Message, 'pinnwandPost' | 'chainPurgeKind' | 'from'>>,
  myAddress: string
): void {
  const ch = pickIncomingToneChannel(novel, myAddress)
  if (!ch) return
  if (!shouldPlayIncomingTone(ch)) return
  playIncomingMessageTone(ch)
}

/** Novel-Zeilen für Ton — gleiche Dedup-Regel wie Journal-Merge. */
export function collectNovelInboxMessages(prev: Message[], incoming: Message[]): Message[] {
  if (incoming.length === 0) return []
  const prevIds = new Set(prev.map((m) => m.id))
  const prevDedup = new Set(prev.map((m) => m.dedupKey).filter((k): k is string => Boolean(k)))
  return incoming.filter((m) => {
    if (prevIds.has(m.id)) return false
    if (m.dedupKey && prevDedup.has(m.dedupKey)) return false
    return true
  })
}
