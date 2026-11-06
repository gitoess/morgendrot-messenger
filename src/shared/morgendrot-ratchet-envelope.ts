/**
 * H.23 C1.1 — Envelope v=3 Header (Double Ratchet).
 * Nur Codec/Validierung — noch kein Ratchet-State / Send-Pfad.
 * Spec: docs/MESSENGER-DOUBLE-RATCHET-C1-SPEC.md
 */

export const MORG_RATCHET_ENVELOPE_VERSION = 3 as const

export type MorgRatchetEnvelopeV3 = {
  v: typeof MORG_RATCHET_ENVELOPE_VERSION
  /** Cipher suite — 1 = AES-GCM (Ist), 2 reserviert */
  cs: number
  /** Sender DH public (base64url oder 0x-hex) */
  dh: string
  /** Previous chain length */
  pn: number
  /** Message number in current sending chain */
  n: number
  msgId: string
  ts: number
}

export type ParseRatchetEnvelopeResult =
  | { ok: true; header: MorgRatchetEnvelopeV3 }
  | { ok: false; error: string }

function isNonNegInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && Number.isFinite(n)
}

/** Kanonisches AAD-JSON (stabile Key-Reihenfolge). */
export function serializeRatchetEnvelopeAad(h: MorgRatchetEnvelopeV3): string {
  return JSON.stringify({
    v: h.v,
    cs: h.cs,
    dh: h.dh,
    pn: h.pn,
    n: h.n,
    msgId: h.msgId,
    ts: h.ts,
  })
}

export function encodeRatchetEnvelopeHeader(h: MorgRatchetEnvelopeV3): string {
  if (h.v !== MORG_RATCHET_ENVELOPE_VERSION) {
    throw new Error(`Ratchet envelope: v muss ${MORG_RATCHET_ENVELOPE_VERSION} sein`)
  }
  if (!isNonNegInt(h.cs) || h.cs < 1 || h.cs > 4) {
    throw new Error('Ratchet envelope: cs ungültig')
  }
  if (typeof h.dh !== 'string' || h.dh.trim().length < 8) {
    throw new Error('Ratchet envelope: dh fehlt')
  }
  if (!isNonNegInt(h.pn) || !isNonNegInt(h.n)) {
    throw new Error('Ratchet envelope: pn/n ungültig')
  }
  if (typeof h.msgId !== 'string' || !h.msgId.trim()) {
    throw new Error('Ratchet envelope: msgId fehlt')
  }
  if (!isNonNegInt(h.ts)) {
    throw new Error('Ratchet envelope: ts ungültig')
  }
  return serializeRatchetEnvelopeAad({
    v: MORG_RATCHET_ENVELOPE_VERSION,
    cs: h.cs,
    dh: h.dh.trim(),
    pn: h.pn,
    n: h.n,
    msgId: h.msgId.trim(),
    ts: h.ts,
  })
}

export function parseRatchetEnvelopeHeader(raw: string): ParseRatchetEnvelopeResult {
  let j: unknown
  try {
    j = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'Ratchet envelope: kein JSON' }
  }
  if (!j || typeof j !== 'object') {
    return { ok: false, error: 'Ratchet envelope: Objekt erwartet' }
  }
  const o = j as Record<string, unknown>
  if (o.v !== MORG_RATCHET_ENVELOPE_VERSION) {
    return { ok: false, error: `Ratchet envelope: v≠${MORG_RATCHET_ENVELOPE_VERSION}` }
  }
  if (!isNonNegInt(o.cs) || o.cs < 1 || o.cs > 4) {
    return { ok: false, error: 'Ratchet envelope: cs ungültig' }
  }
  if (typeof o.dh !== 'string' || o.dh.trim().length < 8) {
    return { ok: false, error: 'Ratchet envelope: dh fehlt' }
  }
  if (!isNonNegInt(o.pn) || !isNonNegInt(o.n)) {
    return { ok: false, error: 'Ratchet envelope: pn/n ungültig' }
  }
  if (typeof o.msgId !== 'string' || !o.msgId.trim()) {
    return { ok: false, error: 'Ratchet envelope: msgId fehlt' }
  }
  if (!isNonNegInt(o.ts)) {
    return { ok: false, error: 'Ratchet envelope: ts ungültig' }
  }
  const header: MorgRatchetEnvelopeV3 = {
    v: MORG_RATCHET_ENVELOPE_VERSION,
    cs: o.cs,
    dh: o.dh.trim(),
    pn: o.pn,
    n: o.n,
    msgId: o.msgId.trim(),
    ts: o.ts,
  }
  return { ok: true, header }
}

/** Peek: ist der Klartext-Header (vor AEAD) ein v3-Envelope? */
export function looksLikeRatchetEnvelopeJson(raw: string): boolean {
  const t = raw.trim()
  if (!t.startsWith('{')) return false
  try {
    const j = JSON.parse(t) as { v?: unknown }
    return j?.v === MORG_RATCHET_ENVELOPE_VERSION
  } catch {
    return false
  }
}
