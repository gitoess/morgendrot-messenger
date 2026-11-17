/**
 * SHA-256 für Browser + Node.
 * Auf LAN-HTTP (`http://192.168…`) ist `crypto.subtle` oft undefined (kein Secure Context) —
 * dann Fallback über `@noble/hashes` (bereits über IOTA-SDK im Tree).
 */
import { sha256 as nobleSha256 } from '@noble/hashes/sha256'

export async function sha256Bytes(u8: Uint8Array): Promise<Uint8Array> {
  const copy = u8 instanceof Uint8Array ? new Uint8Array(u8) : new Uint8Array(u8)
  const subtle = globalThis.crypto?.subtle
  if (subtle?.digest) {
    try {
      const buf = await subtle.digest('SHA-256', copy)
      return new Uint8Array(buf)
    } catch {
      /* insecure context / polyfill gap */
    }
  }
  return nobleSha256(copy)
}
