/**
 * Live-S-ARQ-Fortschritt unabhängig von React-Inbox-Keys / Tab-Fokus.
 * Mesh-RX meldet Segmente hier → Sink subscribed und paintet sofort.
 */

import { parseMorgSegV1Message } from '@/frontend/lib/lora-sarq-parser'
import {
  MORG_SEG_V1_REASSEMBLY_IDLE_MS_DEFAULT,
  MORG_SEG_V1_REASSEMBLY_MAX_NAK_ROUNDS_DEFAULT,
  MorgSegV1ReassemblyBuffer,
} from '@/frontend/lib/lora-sarq-reassembly'
import {
  clearLoraSarqRxDraft,
  loadLoraSarqRxDraft,
  saveLoraSarqRxDraft,
} from '@/frontend/lib/lora-sarq-rx-draft'

export type SarqLivePhaseSnap = {
  msgId: string
  phase: 'luma' | 'chroma'
  n: number
  fromLower: string
  receivedMask: number
  receivedCount: number
  nakRounds: number
  frozen: boolean
  assembled: boolean
}

type Session = {
  buffer: MorgSegV1ReassemblyBuffer
  fromLower: string
  msgId: string
  phase: 'luma' | 'chroma'
  lastN: number
  assembledBytes: Uint8Array | null
  idleTimer: ReturnType<typeof setTimeout> | null
}

const sessions = new Map<string, Session>()
const listeners = new Set<() => void>()
const assembledListeners = new Set<
  (meta: { msgId: string; phase: 'luma' | 'chroma'; fromLower: string; bytes: Uint8Array }) => void
>()

let onNakWireGlobal: ((wire: string) => void) | null = null

export function setSarqLiveNakHandler(fn: ((wire: string) => void) | null): void {
  onNakWireGlobal = fn
}

/**
 * Mesh-`from` kommt mal als `mesh:!abcd`, mal als `!abcd` / `abcd`.
 * Ohne Normierung: Live-Ingest und Sink-Subscribe → zwei Sessions → Tab-Wechsel-Illusion.
 */
export function normalizeSarqPeerKey(from: string): string {
  let s = (from || '').trim().toLowerCase()
  if (s.startsWith('mesh:')) s = s.slice('mesh:'.length).trim()
  if (s && !s.startsWith('!') && /^[0-9a-f]+$/i.test(s)) s = `!${s}`
  return s
}

function sessionKey(fromLower: string, msgId: string, phase: 'luma' | 'chroma'): string {
  return `${normalizeSarqPeerKey(fromLower)}:${msgId.trim().toLowerCase()}:${phase}`
}

function notify(): void {
  for (const l of listeners) {
    try {
      l()
    } catch {
      /* ignore */
    }
  }
}

function clearIdle(s: Session): void {
  if (s.idleTimer != null) {
    clearTimeout(s.idleTimer)
    s.idleTimer = null
  }
}

function armIdle(s: Session): void {
  clearIdle(s)
  if (!s.buffer.needsIdleTimer()) return
  const tick = () => {
    s.idleTimer = null
    const w = s.buffer.emitIdleNakRound()
    if (w) onNakWireGlobal?.(w)
    persistSession(s)
    notify()
    if (s.buffer.needsIdleTimer()) {
      s.idleTimer = setTimeout(tick, MORG_SEG_V1_REASSEMBLY_IDLE_MS_DEFAULT)
    }
  }
  s.idleTimer = setTimeout(tick, MORG_SEG_V1_REASSEMBLY_IDLE_MS_DEFAULT)
}

function getOrCreate(
  fromLower: string,
  msgId: string,
  phase: 'luma' | 'chroma'
): Session {
  const k = sessionKey(fromLower, msgId, phase)
  let s = sessions.get(k)
  if (!s) {
    const buffer = new MorgSegV1ReassemblyBuffer({
      maxNakRounds: MORG_SEG_V1_REASSEMBLY_MAX_NAK_ROUNDS_DEFAULT,
    })
    let assembledBytes: Uint8Array | null = null
    let lastN = 0
    const draft = loadLoraSarqRxDraft(phase)
    if (
      draft &&
      draft.msgId === msgId.trim().toLowerCase() &&
      draft.phase === phase
    ) {
      buffer.importSnapshot(draft)
      lastN = draft.n
      const done = buffer.takeAssembledIfComplete()
      if (done) {
        assembledBytes = done.assembled
        lastN = done.n
        clearLoraSarqRxDraft(phase)
        /** ACK nur wenn Funk noch lauscht — best effort. */
        if (done.completeAck) onNakWireGlobal?.(done.completeAck)
      }
      /** Kein Idle-Arm hier: sonst verbrennt Reload in Sekunden alle NAK-Runden. */
    }
    s = {
      buffer,
      fromLower,
      msgId,
      phase,
      lastN,
      assembledBytes,
      idleTimer: null,
    }
    sessions.set(k, s)
    if (assembledBytes) {
      for (const l of assembledListeners) {
        try {
          l({ msgId, phase, fromLower, bytes: assembledBytes })
        } catch {
          /* ignore */
        }
      }
      notify()
    }
  }
  return s
}

function persistSession(s: Session): void {
  if (s.assembledBytes) {
    clearLoraSarqRxDraft(s.phase)
    return
  }
  saveLoraSarqRxDraft(s.buffer.exportSnapshot(), s.phase)
}

/** IMG_INIT / Late-Join: Session öffnen, optional sofortiges Lücken-NAK. */
export function seedSarqLiveFromInit(
  from: string,
  msgId: string,
  phase: 'luma' | 'chroma',
  n: number,
  opts?: { nakNow?: boolean }
): void {
  const fromLower = normalizeSarqPeerKey(from)
  if (!fromLower || !msgId || n < 1) return
  const s = getOrCreate(fromLower, msgId, phase)
  s.lastN = n
  s.buffer.seedFromInit(msgId, phase, n)
  if (opts?.nakNow !== false) {
    const w = s.buffer.emitNakNow()
    if (w) onNakWireGlobal?.(w)
  }
  persistSession(s)
  if (s.buffer.needsIdleTimer()) armIdle(s)
  notify()
}

function fullMask(n: number): number {
  if (n <= 0) return 0
  if (n >= 32) return 0xffffffff
  return ((1 << n) - 1) >>> 0
}

function snapOf(s: Session): SarqLivePhaseSnap | null {
  const meta = s.buffer.getActiveSession()
  const n = meta?.n || s.lastN
  if (!n && !s.assembledBytes) return null
  if (s.assembledBytes) {
    const nn = n || s.lastN
    return {
      msgId: s.msgId,
      phase: s.phase,
      n: nn,
      fromLower: s.fromLower,
      receivedMask: fullMask(nn),
      receivedCount: nn,
      nakRounds: s.buffer.getNakRoundsSent(),
      frozen: false,
      assembled: true,
    }
  }
  const receivedMask = s.buffer.getReceivedMaskLower32()
  return {
    msgId: s.msgId,
    phase: s.phase,
    n,
    fromLower: s.fromLower,
    receivedMask,
    receivedCount: countReceivedBits(receivedMask, n),
    nakRounds: s.buffer.getNakRoundsSent(),
    frozen: s.buffer.isSessionFrozen(),
    assembled: false,
  }
}

/** Mesh-RX: Segment sofort ingestieren (auch ohne gemounteten Sink). */
export function noteSarqSegFromMesh(
  from: string,
  content: string,
  opts?: { /** Inbox-Backfill: kein Idle-NAK-Sturm nach Reload. */ deferIdle?: boolean }
): void {
  const parsed = parseMorgSegV1Message(content)
  if (!parsed) return
  const fromLower = normalizeSarqPeerKey(from)
  if (!fromLower) return
  const s = getOrCreate(fromLower, parsed.msgId, parsed.phase)
  if (s.assembledBytes) {
    notify()
    return
  }
  s.lastN = parsed.n
  const r = s.buffer.ingest(parsed)
  if (r.staleSessionNak) onNakWireGlobal?.(r.staleSessionNak)
  if (r.duplicateSegment) {
    notify()
    return
  }
  if (r.assembled) {
    clearIdle(s)
    s.lastN = parsed.n
    s.assembledBytes = r.assembled
    clearLoraSarqRxDraft(s.phase)
    if (r.completeAck) onNakWireGlobal?.(r.completeAck)
    for (const l of assembledListeners) {
      try {
        l({
          msgId: parsed.msgId,
          phase: parsed.phase,
          fromLower,
          bytes: r.assembled,
        })
      } catch {
        /* ignore */
      }
    }
    notify()
    return
  }
  persistSession(s)
  if (opts?.deferIdle) {
    clearIdle(s)
  } else if (s.buffer.needsIdleTimer()) {
    armIdle(s)
  } else {
    clearIdle(s)
  }
  notify()
}

export function getSarqLivePhase(
  from: string,
  msgId: string,
  phase: 'luma' | 'chroma'
): SarqLivePhaseSnap | null {
  const s = sessions.get(sessionKey(from, msgId, phase))
  if (!s) return null
  return snapOf(s)
}

export function getSarqLiveAssembled(
  from: string,
  msgId: string,
  phase: 'luma' | 'chroma'
): Uint8Array | null {
  return sessions.get(sessionKey(from, msgId, phase))?.assembledBytes ?? null
}

export function requestSarqLiveMissing(
  from: string,
  msgId: string,
  phase: 'luma' | 'chroma'
): string | null {
  const s = sessions.get(sessionKey(from, msgId, phase))
  if (!s || s.assembledBytes) return null
  const w = s.buffer.emitNakNow()
  if (w) onNakWireGlobal?.(w)
  persistSession(s)
  if (s.buffer.needsIdleTimer()) armIdle(s)
  notify()
  return w
}

export function subscribeSarqLiveProgress(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function subscribeSarqLiveAssembled(
  cb: (meta: { msgId: string; phase: 'luma' | 'chroma'; fromLower: string; bytes: Uint8Array }) => void
): () => void {
  assembledListeners.add(cb)
  return () => {
    assembledListeners.delete(cb)
  }
}

/** Vitest / Reset. */
export function resetSarqLiveProgressForTests(): void {
  for (const s of sessions.values()) clearIdle(s)
  sessions.clear()
  listeners.clear()
  assembledListeners.clear()
  onNakWireGlobal = null
}

export function countReceivedBits(mask: number, n: number): number {
  let c = 0
  const cap = Math.min(32, Math.max(0, n))
  for (let i = 0; i < cap; i++) {
    if ((mask >>> i) & 1) c++
  }
  return c
}

export function maskToReceivedSet(mask: number, n: number): Set<number> {
  const s = new Set<number>()
  const cap = Math.min(32, Math.max(0, n))
  for (let i = 0; i < cap; i++) {
    if ((mask >>> i) & 1) s.add(i)
  }
  return s
}
