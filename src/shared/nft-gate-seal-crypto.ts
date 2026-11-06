/**
 * B2-P4b — Seal wrap-key derivation (Broker + Capsule).
 * identity = nft object id bytes (32) [+ optional requiredWallet ascii].
 */

const INFO_PREFIX = new TextEncoder().encode('morgendrot-nft-seal-p4b-v1')
const HEX64 = /^0x[a-f0-9]{64}$/

function getSubtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle
  if (!s) throw new Error('Web Crypto fehlt.')
  return s
}

function buf(u: Uint8Array): Parameters<SubtleCrypto['importKey']>[1] {
  return u as Parameters<SubtleCrypto['importKey']>[1]
}

export function nftObjectIdToIdentityBytes(nftObjectId: string): Uint8Array {
  const h = nftObjectId.trim().toLowerCase().replace(/^0x/, '')
  if (!/^[a-f0-9]{64}$/.test(h)) throw new Error('nftObjectId: 0x + 64 Hex.')
  const out = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function buildNftSealInfo(
  nftObjectId: string,
  requiredWallet?: string | null
): Uint8Array {
  const id = nftObjectIdToIdentityBytes(nftObjectId)
  const wallet = requiredWallet?.trim() ? requiredWallet.trim().toLowerCase() : ''
  if (wallet && !HEX64.test(wallet)) throw new Error('requiredWallet ungültig.')
  const tail = wallet ? new TextEncoder().encode(`|w|${wallet}`) : new Uint8Array(0)
  const info = new Uint8Array(INFO_PREFIX.length + id.length + tail.length)
  info.set(INFO_PREFIX, 0)
  info.set(id, INFO_PREFIX.length)
  if (tail.length) info.set(tail, INFO_PREFIX.length + id.length)
  return info
}

/** 32-Byte wrap key raw (AES-256). */
export async function deriveNftSealWrapKeyRaw(
  master: Uint8Array,
  nftObjectId: string,
  requiredWallet?: string | null
): Promise<Uint8Array> {
  if (master.length < 16) throw new Error('Seal-Master zu kurz (min. 16 Byte).')
  const subtle = getSubtle()
  const info = buildNftSealInfo(nftObjectId, requiredWallet)
  const ikm = await subtle.importKey('raw', buf(master), 'HKDF', false, ['deriveBits'])
  const bits = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info },
    ikm,
    256
  )
  return new Uint8Array(bits)
}

export function parseNftGateSealMaster(raw: string): Uint8Array {
  const t = raw.trim()
  if (!t) throw new Error('Seal-Master leer.')
  if (/^[0-9a-fA-F]{64}$/.test(t)) {
    const out = new Uint8Array(32)
    for (let i = 0; i < 32; i++) out[i] = parseInt(t.slice(i * 2, i * 2 + 2), 16)
    return out
  }
  if (/^0x[0-9a-fA-F]{64}$/i.test(t)) {
    return parseNftGateSealMaster(t.slice(2))
  }
  // base64
  const bin = Buffer.from(t, 'base64')
  if (bin.length < 16) throw new Error('Seal-Master Base64 zu kurz.')
  return new Uint8Array(bin.subarray(0, 32))
}

export function bytesToBase64(u8: Uint8Array): string {
  return Buffer.from(u8).toString('base64')
}

export function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'))
}
