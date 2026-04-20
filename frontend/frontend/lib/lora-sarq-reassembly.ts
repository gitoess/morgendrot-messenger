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
export const MORG_SEG_V1_REASSEMBLY_IDLE_MS_DEFAULT = 15_000

/** Stufe 3: maximale NAK-Runden pro Session (Airtime / Akku). */
export const MORG_SEG_V1_REASSEMBLY_MAX_NAK_ROUNDS_DEFAULT = 3

export type MorgSegV1SessionKey = `${string}:${'luma' | 'chroma'}`

export function morgSegV1SessionKey(msgId: string, phase: 'luma' | 'chroma'): MorgSegV1SessionKey {
  return `${msgId.toLowerCase()}:${phase}`
}

export type MorgSegV1IngestResult = {
  /** Alle `n` Segmente valide eingetroffen — Bytes in Reihenfolge `seg` 0..n-1. */
  assembled?: Uint8Array
  /** NAK für eine verworfene, noch unvollständige Session (z. B. Phasen-/MsgId-Wechsel). */
  staleSessionNak?: string
  /** Gleicher Index war schon da (Gate „Neu?“) — Idle-Timer nicht anstoßen. */
  duplicateSegment?: true
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
      if (cur.frozen) {
        if (cur.segs.has(parsed.seg)) return { duplicateSegment: true }
        cur.segs.set(parsed.seg, parsed.raw)
        if (isComplete(cur)) {
          const assembled = assembleOrdered(cur)
          this.session = null
          return { assembled }
        }
        return {}
      }
      if (cur.segs.has(parsed.seg)) return { duplicateSegment: true }
      cur.segs.set(parsed.seg, parsed.raw)
      if (isComplete(cur)) {
        const assembled = assembleOrdered(cur)
        this.session = null
        return { assembled }
      }
      return {}
    }

    this.session = newSessionFromFirstSeg(parsed)
    const s = this.session
    if (isComplete(s)) {
      const assembled = assembleOrdered(s)
      this.session = null
      return { assembled }
    }
    return {}
  }
}
