/**
 * `MORG_COMPACT_IMG_V1` Netto-Blob (Mgvi): Luma-WebP + Chroma-PNG + SHA-256(Original).
 * Transportneutral — Kodierung im Client (WASM) oder Node (Sharp).
 */

export const VAULT_IMAGE_MAGIC = new Uint8Array([0x4d, 0x67, 0x76, 0x69])
export const VAULT_IMAGE_VERSION = 1
export const VAULT_IMAGE_SHA256_LEN = 32

/** Hartes Netto-Budget (IOTA/Online); mit Wire-UTF-8 ~16 KiB Move-kompatibel. */
export const MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES = 11_800

export function packVaultImageBlob(
  luma: Uint8Array,
  chroma: Uint8Array,
  originalSha256: Uint8Array
): Uint8Array {
  if (originalSha256.length !== VAULT_IMAGE_SHA256_LEN) {
    throw new Error('vault-image: originalSha256 must be 32 bytes')
  }
  const headerLen = VAULT_IMAGE_MAGIC.length + 1 + 4 + 4
  const total = headerLen + luma.length + chroma.length + VAULT_IMAGE_SHA256_LEN
  const out = new Uint8Array(total)
  let o = 0
  out.set(VAULT_IMAGE_MAGIC, o)
  o += VAULT_IMAGE_MAGIC.length
  out[o++] = VAULT_IMAGE_VERSION
  out[o++] = (luma.length >>> 24) & 0xff
  out[o++] = (luma.length >>> 16) & 0xff
  out[o++] = (luma.length >>> 8) & 0xff
  out[o++] = luma.length & 0xff
  out[o++] = (chroma.length >>> 24) & 0xff
  out[o++] = (chroma.length >>> 16) & 0xff
  out[o++] = (chroma.length >>> 8) & 0xff
  out[o++] = chroma.length & 0xff
  out.set(luma, o)
  o += luma.length
  out.set(chroma, o)
  o += chroma.length
  out.set(originalSha256, o)
  return out
}

export type VaultImagePacked = {
  plaintext: Uint8Array
  lumaWebpBytes: number
  chromaPngBytes: number
}

export function packVaultImagePlaintext(
  luma: Uint8Array,
  chroma: Uint8Array,
  originalSha256: Uint8Array
): VaultImagePacked {
  const plaintext = packVaultImageBlob(luma, chroma, originalSha256)
  return { plaintext, lumaWebpBytes: luma.length, chromaPngBytes: chroma.length }
}
