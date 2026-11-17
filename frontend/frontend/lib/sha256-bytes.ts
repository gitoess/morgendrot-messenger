/**
 * SHA-256 Bytes — Secure Context (`crypto.subtle`) oder `@noble/hashes` (LAN-HTTP).
 */
import { sha256 as nobleSha256 } from '@noble/hashes/sha256'

/** Copy + SHA-256; works on insecure LAN HTTP where `crypto.subtle` is missing. */

export async function sha256Bytes(data: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const src = data instanceof Uint8Array ? data : new Uint8Array(data)
  const copy = new Uint8Array(src.byteLength)
  copy.set(src)
  const subtle = globalThis.crypto?.subtle
  if (subtle?.digest) {
    try {
      return new Uint8Array(await subtle.digest('SHA-256', copy))
    } catch {
      /* insecure context / polyfill gap */
    }
  }
  return nobleSha256(copy)
}

export function sha256BytesToHex(digest: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < digest.length; i++) hex += digest[i]!.toString(16).padStart(2, '0')
  return hex
}

export async function sha256HexOfBytes(data: ArrayBuffer | Uint8Array): Promise<string> {
  return sha256BytesToHex(await sha256Bytes(data))
}
