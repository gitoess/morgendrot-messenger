/**
 * Such-Policy für IOTA `MORG_COMPACT_IMG_V1` (Qualität zuerst pro Preset) — ohne DOM/Sharp.
 */

import { selectIotaCompactPresets } from './iota-compact-presets'
import {
  MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES,
  packVaultImagePlaintext,
  type VaultImagePacked,
} from './vault-image-format'

export type IotaCompactEncodeCallbacks = {
  encodeChroma: (cw: number, ch: number) => Promise<Uint8Array | null>
  encodeLuma: (dim: number, quality: number) => Promise<Uint8Array | null>
}

export type IotaCompactEncodeOk = VaultImagePacked & {
  usedQuality: number
  usedMaxDim: number
  chromaW: number
  chromaH: number
}

export async function encodeIotaCompactFitChain(
  originalSha256: Uint8Array,
  callbacks: IotaCompactEncodeCallbacks,
  maxPlaintextBytes = MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES
): Promise<{ ok: true; result: IotaCompactEncodeOk } | { ok: false; error: string }> {
  const cap = Math.min(
    Math.max(4000, maxPlaintextBytes),
    MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES
  )
  const presets = selectIotaCompactPresets(cap)

  for (const { dim, cw, ch } of presets) {
    const chroma = await callbacks.encodeChroma(cw, ch)
    if (!chroma) continue
    for (let q = 88; q >= 28; q -= 2) {
      const luma = await callbacks.encodeLuma(dim, q)
      if (!luma) continue
      const packed = packVaultImagePlaintext(luma, chroma, originalSha256)
      if (packed.plaintext.length <= cap) {
        return {
          ok: true,
          result: {
            ...packed,
            usedQuality: q,
            usedMaxDim: dim,
            chromaW: cw,
            chromaH: ch,
          },
        }
      }
    }
  }

  return {
    ok: false,
    error: `Bild nicht unter ${cap} B Blob bringbar (IOTA-Limit). Anderes Motiv oder kleinere Datei.`,
  }
}
