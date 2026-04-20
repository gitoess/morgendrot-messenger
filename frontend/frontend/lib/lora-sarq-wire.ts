/**
 * Morgendrot S-ARQ — Wire-Helfer (Segment-Frames, NAK-Maske, CRC16).
 * Normativ: `docs/LORA-MORGENDROT-S-ARQ-SPEC.md`. Noch kein Parser/Empfang in der Chat-UI.
 */

import { MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES, wireUtf8ByteLength } from '@/frontend/lib/compact-image-wire'
import { uint8ArrayToBase64 } from '@/frontend/lib/emergency-binary-browser'

export { MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES as LORA_SARQ_MESH_WIRE_UTF8_MAX } from '@/frontend/lib/compact-image-wire'

/** CRC-16/CCITT-FALSE: Poly 0x1021, Init 0xFFFF, kein Reflect, XOROUT 0 (z. B. „123456789“ → 0x29B1). */
export function crc16CcittFalse(data: Uint8Array): number {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]! << 8
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc & 0xffff
}

export type MorgSegV1HeaderDims = {
  msgId: string
  phase: 'luma' | 'chroma'
  seg: number
  n: number
}

/**
 * Ein Segment-Wire gemäß `docs/LORA-MORGENDROT-S-ARQ-SPEC.md` §2.2.
 * `len` = Zeichenlänge des Base64-Payloads (wie bei `MORG_LUMA_V1`).
 */
export function buildMorgSegV1Wire(p: MorgSegV1HeaderDims & { raw: Uint8Array }): string {
  const b64 = uint8ArrayToBase64(p.raw)
  const crc = crc16CcittFalse(p.raw)
  const crcHex = (crc & 0xffff).toString(16).padStart(4, '0')
  return `[[MORG_SEG_V1:msgId=${p.msgId}|phase=${p.phase}|seg=${p.seg}|n=${p.n}|len=${b64.length}|${b64}|crc=${crcHex}]]`
}

/** NAK: Bit _i_ = 1 ⇒ Segmentindex _i_ fehlt (nachzusenden). Maske 32 Bit (8 Hex-Ziffern). */
export function buildMorgNakV1Wire(p: { msgId: string; phase: 'luma' | 'chroma'; mask: number }): string {
  const m = p.mask >>> 0
  return `[[MORG_NAK_V1:msgId=${p.msgId}|phase=${p.phase}|mask=${m.toString(16).padStart(8, '0')}]]`
}

export const MORG_NAK_V1_MASK_MAX_INDEX = 31

export function nakMaskFromMissingIndices(missing: readonly number[]): number {
  let mask = 0
  for (const i of missing) {
    if (!Number.isInteger(i) || i < 0 || i > MORG_NAK_V1_MASK_MAX_INDEX) {
      throw new RangeError(`NAK: Segmentindex muss 0..${MORG_NAK_V1_MASK_MAX_INDEX} sein, war ${i}`)
    }
    mask |= 1 << i
  }
  return mask >>> 0
}

/** Indizes _i_ mit Bit _i_ = 1 in `mask` (fehlende Segmente), nur _i_ < min(32, segmentCount). */
export function missingIndicesFromNakMask(mask: number, segmentCount: number): number[] {
  const m = mask >>> 0
  const cap = Math.min(32, Math.max(0, segmentCount))
  const out: number[] = []
  for (let i = 0; i < cap; i++) {
    if ((m >> i) & 1) out.push(i)
  }
  return out
}

/**
 * Größte Rohbyte-Länge `raw`, sodass `buildMorgSegV1Wire` in `utf8Budget` UTF-8-Bytes passt.
 * Nutzt binäre Suche; Nutzlastbytes sind beliebig (Base64-Länge hängt nur von |raw| ab).
 */
export function computeMaxMorgSegV1RawPayloadBytes(
  dims: MorgSegV1HeaderDims,
  utf8Budget: number = MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES
): number {
  let lo = 0
  let hi = Math.min(utf8Budget, 480)
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    const raw = new Uint8Array(mid)
    const w = buildMorgSegV1Wire({ ...dims, raw })
    if (wireUtf8ByteLength(w) <= utf8Budget) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** Default-Kopf (typische Session); `computeMaxMorgSegV1RawPayloadBytes(DEFAULT_MORG_SEG_DIMS)`. */
export const DEFAULT_MORG_SEG_DIMS: MorgSegV1HeaderDims = {
  msgId: 'deadbeef',
  phase: 'luma',
  seg: 0,
  n: 16,
}

/** Vorberechnet mit `DEFAULT_MORG_SEG_DIMS` und `MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES` (500). */
export const MORG_SEG_V1_DEFAULT_MAX_RAW_BYTES = computeMaxMorgSegV1RawPayloadBytes(DEFAULT_MORG_SEG_DIMS)
