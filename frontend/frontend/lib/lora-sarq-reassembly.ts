/**
 * Morgendrot S-ARQ — Reassembly-Puffer für `MORG_SEG_V1` (pro msgId+phase).
 * Segmentlängen können variieren; Speicherung pro Index, Zusammenbau bei Vollständigkeit.
 */

import type { ParsedMorgSegV1 } from '@/frontend/lib/lora-sarq-parser'
import { buildMorgNakV1Wire, nakMaskFromMissingIndices } from '@/frontend/lib/lora-sarq-wire'

export type MorgSegV1SessionKey = `${string}:${'luma' | 'chroma'}`

export function morgSegV1SessionKey(msgId: string, phase: 'luma' | 'chroma'): MorgSegV1SessionKey {
  return `${msgId.toLowerCase()}:${phase}`
}

export type MorgSegV1IngestResult = {
  /** Alle `n` Segmente valide eingetroffen — Bytes in Reihenfolge `seg` 0..n-1. */
  assembled?: Uint8Array
  /** NAK für eine verworfene, noch unvollständige Session (z. B. Phasen-/MsgId-Wechsel). */
  staleSessionNak?: string
}

type ActiveSession = {
  msgId: string
  phase: 'luma' | 'chroma'
  n: number
  /** Segmentindex → Nutzlastbytes (CRC bereits im Parser geprüft). */
  segs: Map<number, Uint8Array>
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

export class MorgSegV1ReassemblyBuffer {
  private session: ActiveSession | null = null

  /** Verwirft den aktuellen Puffer (kein NAK). */
  reset(): void {
    this.session = null
  }

  getActiveSession(): Readonly<Pick<ActiveSession, 'msgId' | 'phase' | 'n'>> | null {
    const s = this.session
    if (!s) return null
    return { msgId: s.msgId, phase: s.phase, n: s.n }
  }

  /**
   * Timeout-Handler: NAK für die aktuelle Session, wenn noch Lücken bestehen.
   * Gibt `null`, wenn idle oder schon komplett.
   */
  suggestNakIfIncomplete(): string | null {
    const s = this.session
    if (!s || isComplete(s)) return null
    return nakWireForSession(s)
  }

  /**
   * Verarbeitet ein geparstes Segment. Bei Sessionwechsel wird ggf. `staleSessionNak` gesetzt.
   */
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
      cur.segs.set(parsed.seg, parsed.raw)
      if (isComplete(cur)) {
        const assembled = assembleOrdered(cur)
        this.session = null
        return { assembled }
      }
      return {}
    }

    // Neues Session-Objekt (erstes Segment dieser msgId/phase)
    const segs = new Map<number, Uint8Array>()
    segs.set(parsed.seg, parsed.raw)
    this.session = {
      msgId: parsed.msgId,
      phase: parsed.phase,
      n: parsed.n,
      segs,
    }
    const s = this.session
    if (isComplete(s)) {
      const assembled = assembleOrdered(s)
      this.session = null
      return { assembled }
    }
    return {}
  }
}
