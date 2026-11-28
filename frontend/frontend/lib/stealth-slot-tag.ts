/**
 * Stealth `slot_tag` — reine Ableitung (Spec `docs/STEALTH-SLOT-TAG-SPEC.md`).
 * Kein Chain/Move/UI. Blake2b-256 via @noble/hashes (kein Web-Crypto-Blake2b).
 */
import { blake2b } from '@noble/hashes/blake2b'

/** Domain-Separator laut Spec §3.1 */
export const STEALTH_SLOT_DOMAIN = 'slot'

/** Max Entries pro Epoch-Bucket (Spec §3.1.1) — nur Konstante für spätere Move/Client-Scheibe. */
export const STEALTH_BUCKET_ENTRY_CAP = 32

const te = new TextEncoder()

/** `epoch` als u64 Big-Endian (8 Byte). */
export function encodeEpochU64Be(epoch: number | bigint): Uint8Array {
  let n = typeof epoch === 'bigint' ? epoch : BigInt(Math.trunc(epoch))
  if (n < 0n) throw new Error('stealth epoch muss >= 0 sein')
  if (n > 0xffffffffffffffffn) throw new Error('stealth epoch überschreitet u64')
  const out = new Uint8Array(8)
  for (let i = 7; i >= 0; i--) {
    out[i] = Number(n & 0xffn)
    n >>= 8n
  }
  return out
}

/**
 * Default-Epoche: UTC-Stunden seit Unix-Epoch (floor(ms / 3_600_000)).
 * Lookahead nutzt ±W um diesen Wert.
 */
export function stealthEpochHourUtc(nowMs: number = Date.now()): bigint {
  if (!Number.isFinite(nowMs)) throw new Error('stealth nowMs ungültig')
  return BigInt(Math.floor(nowMs / 3_600_000))
}

/** Epochs für Lookahead: [center−W … center+W]. */
export function lookaheadStealthEpochs(centerEpoch: number | bigint, windowW: number): bigint[] {
  const c = typeof centerEpoch === 'bigint' ? centerEpoch : BigInt(Math.trunc(centerEpoch))
  const w = Math.max(0, Math.trunc(windowW))
  const out: bigint[] = []
  for (let d = -w; d <= w; d++) out.push(c + BigInt(d))
  return out
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let n = 0
  for (const p of parts) n += p.length
  const out = new Uint8Array(n)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/**
 * `slot_tag = Blake2b256(SharedSecret || UTF8("slot") || epoch_u64_be)` — 32 Byte.
 * Gleicher Peer + gleiche Epoche → gleicher Tag (Bucket); Multi-Msg = Queue darunter (Move).
 */
export function deriveStealthSlotTag(sharedSecret: Uint8Array, epoch: number | bigint): Uint8Array {
  if (!(sharedSecret instanceof Uint8Array) || sharedSecret.length < 1) {
    throw new Error('stealth SharedSecret fehlt')
  }
  const msg = concatBytes([sharedSecret, te.encode(STEALTH_SLOT_DOMAIN), encodeEpochU64Be(epoch)])
  return blake2b(msg, { dkLen: 32 })
}

export function stealthSlotTagToHex(tag: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < tag.length; i++) hex += tag[i]!.toString(16).padStart(2, '0')
  return hex
}

export function deriveStealthSlotTagHex(sharedSecret: Uint8Array, epoch: number | bigint): string {
  return stealthSlotTagToHex(deriveStealthSlotTag(sharedSecret, epoch))
}
