/**
 * Morgendrot S-ARQ — Reassembly-Puffer für `MORG_SEG_V1` (pro msgId+phase+n).
 *
 * **„Binäre 3“ (Zustand):** (1) passiv sammeln → (2) NAK nach Idle → (3) nach `maxNakRounds`
 * ohne Vollständigkeit: Session **eingefroren** (keine weiteren NAKs, kein Timer-Spam).
 *
 * **„Logische 4“ (pro Segment):** (1) **Gültig** = CRC ok (bereits in `parseMorgSegV1Message`) →
 * (2) **Zugehörig** = gleiche Session (`msgId`+`phase`+`n`) → (3) **Neu** = Index noch nicht
 * gespeichert (Duplikat-Rebroadcast ignorieren, kein Idle-Reset) → (4) **Vollständig** =
 * alle Indizes 0..n-1 da → zusammenbauen, Session schließen.
 *
 * Segmentlängen variieren → Speicherung `Map<seg, Uint8Array>`, kein fixes `n×321`-Array.
 */

import type { ParsedMorgSegV1 } from '@/frontend/lib/lora-sarq-parser'
import { buildMorgNakV1Wire, nakMaskFromMissingIndices } from '@/frontend/lib/lora-sarq-wire'

/** Mesh-Heuristik: ~2–5 s/Hop, bis ca. 3 Hops + Spielraum → weniger „NAK aus Luft“. */
/** Nach Idle: NAK für Lücken (Late-Join / verlorene Segmente). Etwas kürzer als 15 s für PC-Funk. */
/** Schneller als Sender-NAK-Fenster (6,5 s), damit Lücken-NAK vor Chroma-Start ankommt. */
export const MORG_SEG_V1_REASSEMBLY_IDLE_MS_DEFAULT = 2_500

/** Stufe 3: Idle-NAKs pro Session (INIT-NAK zählt nicht). LongFast braucht mehr Runden. */
/** Idle-NAKs bevor Freeze; Desk/MediumFast: etwas mehr Spielraum als 6. */
/**
 * Idle-NAKs nach Funk-Ruhe. Höher als früher (8), weil MediumFast-Burst + Rate-Limit
 * leicht 8× Idle in der Luma-Phase auslösen kann — sonst Freeze mitten im Transfer.
 */
export const MORG_SEG_V1_REASSEMBLY_MAX_NAK_ROUNDS_DEFAULT = 24

export type MorgSegV1SessionKey = `${string}:${'luma' | 'chroma'}`

export function morgSegV1SessionKey(msgId: string, phase: 'luma' | 'chroma'): MorgSegV1SessionKey {
  return `${msgId.toLowerCase()}:${phase}`
}

export type MorgSegV1IngestResult = {
  /** Alle `n` Segmente valide eingetroffen — Bytes in Reihenfolge `seg` 0..n-1. */
  assembled?: Uint8Array
  /**
   * Positiv-ACK an den Sender: `MORG_NAK_V1` mit **mask=0** = Phase vollständig
   * (Sender darf nicht bei Funk-Stille zur nächsten Phase springen).
   */
  completeAck?: string
  /** NAK für eine verworfene, noch unvollständige Session (z. B. Phasen-/MsgId-Wechsel). */
  staleSessionNak?: string
  /** Gleicher Index war schon da (Gate „Neu?“) — Idle-Timer nicht anstoßen. */
  duplicateSegment?: true
}

function completeAckWire(msgId: string, phase: 'luma' | 'chroma'): string {
  return buildMorgNakV1Wire({ msgId, phase, mask: 0 })
}

export type MorgSegV1ReassemblyBufferOpts = {
  maxNakRounds?: number
}

type ActiveSession = {
  msgId: string
  phase: 'luma' | 'chroma'
  n: number
  segs: Map<number, Uint8Array>
  /** Anzahl bereits gesendeter Idle-NAKs in dieser Session. */
  nakRoundsSent: number
  /** Nach `maxNakRounds` NAKs ohne Erfolg: keine weiteren NAKs / kein erneutes Idle für diese Session. */
  frozen: boolean
}

/** localStorage-Snapshot unvollständiger Empfang (Resume / NAK „fehlende Segmente“). */
export type MorgSegV1SessionSnapshot = {
  msgId: string
  phase: 'luma' | 'chroma'
  n: number
  segsB64: Record<string, string>
  nakRoundsSent: number
  frozen: boolean
}

function bytesToB64(u8: Uint8Array): string {
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!)
  return btoa(s)
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function missingSegIndices(s: ActiveSession): number[] {
  const out: number[] = []
  for (let i = 0; i < s.n; i++) {
    if (!s.segs.has(i)) out.push(i)
  }
  return out
}

function isComplete(s: ActiveSession): boolean {
  return s.segs.size === s.n && missingSegIndices(s).length === 0
}

function assembleOrdered(s: ActiveSession): Uint8Array {
  let len = 0
  for (let i = 0; i < s.n; i++) {
    len += s.segs.get(i)!.length
  }
  const out = new Uint8Array(len)
  let o = 0
  for (let i = 0; i < s.n; i++) {
    const part = s.segs.get(i)!
    out.set(part, o)
    o += part.length
  }
  return out
}

function nakWireForSession(s: ActiveSession): string | null {
  const missing = missingSegIndices(s)
  if (missing.length === 0) return null
  const maskable = missing.filter((i) => i <= 31)
  if (maskable.length === 0) return null
  const mask = nakMaskFromMissingIndices(maskable)
  return buildMorgNakV1Wire({ msgId: s.msgId, phase: s.phase, mask })
}

function newSessionFromFirstSeg(parsed: ParsedMorgSegV1): ActiveSession {
  const segs = new Map<number, Uint8Array>()
  segs.set(parsed.seg, parsed.raw)
  return {
    msgId: parsed.msgId,
    phase: parsed.phase,
    n: parsed.n,
    segs,
    nakRoundsSent: 0,
    frozen: false,
  }
}

export class MorgSegV1ReassemblyBuffer {
  private session: ActiveSession | null = null
  private readonly maxNakRounds: number

  constructor(opts: MorgSegV1ReassemblyBufferOpts = {}) {
    this.maxNakRounds = opts.maxNakRounds ?? MORG_SEG_V1_REASSEMBLY_MAX_NAK_ROUNDS_DEFAULT
  }

  reset(): void {
    this.session = null
  }

  /** Unvollständige Session für Persistenz; `null` wenn leer/komplett. */
  exportSnapshot(): MorgSegV1SessionSnapshot | null {
    const s = this.session
    if (!s || isComplete(s)) return null
    const segsB64: Record<string, string> = {}
    for (const [i, raw] of s.segs) {
      segsB64[String(i)] = bytesToB64(raw)
    }
    return {
      msgId: s.msgId,
      phase: s.phase,
      n: s.n,
      segsB64,
      nakRoundsSent: s.nakRoundsSent,
      frozen: s.frozen,
    }
  }

  importSnapshot(snap: MorgSegV1SessionSnapshot): boolean {
    if (!snap || typeof snap.msgId !== 'string') return false
    if (snap.phase !== 'luma' && snap.phase !== 'chroma') return false
    if (!Number.isInteger(snap.n) || snap.n < 1 || snap.n > 32) return false
    const segs = new Map<number, Uint8Array>()
    for (const [k, b64] of Object.entries(snap.segsB64 ?? {})) {
      const i = parseInt(k, 10)
      if (!Number.isInteger(i) || i < 0 || i >= snap.n || typeof b64 !== 'string') continue
      try {
        segs.set(i, b64ToBytes(b64))
      } catch {
        /* skip bad seg */
      }
    }
    /** Resume: nie eingefroren starten (sonst keine NAKs / kein Lücken-Button-Effekt). */
    this.session = {
      msgId: snap.msgId.trim().toLowerCase(),
      phase: snap.phase,
      n: snap.n,
      segs,
      nakRoundsSent: 0,
      frozen: false,
    }
    return true
  }

  /**
   * Nach `importSnapshot` / manuell: wenn alle Segmente da → JPEG + ACK, Session zu.
   * (Früher verwarf import komplette Drafts still — Live: Chroma 6/6 ohne Bild.)
   */
  takeAssembledIfComplete(): { assembled: Uint8Array; completeAck: string; msgId: string; phase: 'luma' | 'chroma'; n: number } | null {
    const s = this.session
    if (!s || !isComplete(s)) return null
    const assembled = assembleOrdered(s)
    const completeAck = completeAckWire(s.msgId, s.phase)
    const meta = { msgId: s.msgId, phase: s.phase, n: s.n }
    this.session = null
    return { assembled, completeAck, ...meta }
  }

  /**
   * IMG_INIT / Late-Join: Session mit `n` öffnen ohne Segmente (oder bestehende behalten).
   * Danach `emitIdleNakRound` / sofortiges NAK für fehlende Indizes.
   */
  seedFromInit(msgId: string, phase: 'luma' | 'chroma', n: number): void {
    if (!Number.isInteger(n) || n < 1 || n > 32) return
    const id = msgId.trim().toLowerCase()
    const cur = this.session
    if (cur && cur.msgId === id && cur.phase === phase && cur.n === n) {
      cur.frozen = false
      return
    }
    this.session = {
      msgId: id,
      phase,
      n,
      segs: new Map(),
      nakRoundsSent: 0,
      frozen: false,
    }
  }

  /**
   * Sofort-NAK für Lücken (nach INIT / Resume).
   * Zählt **nicht** gegen `maxNakRounds` — sonst friert die Session ein, bevor der
   * LongFast-Burst fertig ist, und der Sender sieht keine Luma-NAKs mehr.
   */
  emitNakNow(): string | null {
    const s = this.session
    if (!s || isComplete(s)) return null
    s.frozen = false
    return nakWireForSession(s)
  }

  getActiveSession(): Readonly<Pick<ActiveSession, 'msgId' | 'phase' | 'n'>> | null {
    const s = this.session
    if (!s) return null
    return { msgId: s.msgId, phase: s.phase, n: s.n }
  }

  /** Empfangsbitmaske Bits `0..min(n-1,31)` (1 = Segment gespeichert). */
  getReceivedMaskLower32(): number {
    const s = this.session
    if (!s) return 0
    let m = 0
    for (const i of s.segs.keys()) {
      if (i >= 0 && i <= 31) m |= 1 << i
    }
    return m >>> 0
  }

  isSessionFrozen(): boolean {
    return this.session?.frozen ?? false
  }

  getNakRoundsSent(): number {
    return this.session?.nakRoundsSent ?? 0
  }

  /**
   * Aktive Session existiert, ist unvollständig und nicht eingefroren → Idle-Timer sinnvoll.
   */
  needsIdleTimer(): boolean {
    const s = this.session
    return s != null && !isComplete(s) && !s.frozen
  }

  /**
   * Stufe 2 + 3: ein Idle-NAK bei Lücken, bis `maxNakRounds` Erzeugungen; danach **frozen** + `null`.
   */
  emitIdleNakRound(): string | null {
    const s = this.session
    if (!s || isComplete(s) || s.frozen) return null
    if (s.nakRoundsSent >= this.maxNakRounds) {
      s.frozen = true
      return null
    }
    const wire = nakWireForSession(s)
    if (!wire) return null
    s.nakRoundsSent++
    if (s.nakRoundsSent >= this.maxNakRounds) s.frozen = true
    return wire
  }

  ingest(parsed: ParsedMorgSegV1): MorgSegV1IngestResult {
    const cur = this.session
    const sameSession =
      cur != null &&
      cur.msgId === parsed.msgId &&
      cur.phase === parsed.phase &&
      cur.n === parsed.n

    if (cur != null && !sameSession) {
      const staleSessionNak = isComplete(cur) ? undefined : nakWireForSession(cur) ?? undefined
      this.session = null
      const out = this.ingest(parsed)
      return staleSessionNak ? { ...out, staleSessionNak } : out
    }

    if (cur != null && sameSession) {
      if (cur.segs.has(parsed.seg)) return { duplicateSegment: true }
      cur.segs.set(parsed.seg, parsed.raw)
      /**
       * Neues Segment = Transfer lebt noch.
       * Idle-NAKs während Burst/Repair dürfen die Session nicht dauerhaft einfrieren
       * (Live: Luma 11/16 + Chroma 5/6 bei NAK 8 → keine weiteren NAKs, Bild bleibt S/W).
       */
      cur.frozen = false
      cur.nakRoundsSent = 0
      if (isComplete(cur)) {
        const assembled = assembleOrdered(cur)
        const ack = completeAckWire(cur.msgId, cur.phase)
        this.session = null
        return { assembled, completeAck: ack }
      }
      return {}
    }

    this.session = newSessionFromFirstSeg(parsed)
    const s = this.session
    if (isComplete(s)) {
      const assembled = assembleOrdered(s)
      const ack = completeAckWire(s.msgId, s.phase)
      this.session = null
      return { assembled, completeAck: ack }
    }
    return {}
  }
}
