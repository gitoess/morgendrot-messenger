/**
 * VaultImagePipeline – **nur IOTA / Online** (`MORG_COMPACT_IMG_V1`): Luma (Grayscale WebP) + Chroma (RGB-PNG)
 * als ein Binär-Blob mit Header. Rekonstruktion: `reconstructBlendToPng` (Luma + Chroma, Blend „colour“).
 *
 * **Nicht** für Funk/LoRa: Mesh nutzt `prepareImageForLoRa` (zwei JPEG-Wires `MORG_LUMA_V1` / `MORG_CHROMA_V1`) –
 * strikt getrennte API (`/api/lora-progressive-encode` vs `/api/compact-image-encode`).
 */
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES } from './messenger-media-limits.js'

export const VAULT_IMAGE_MAGIC = Buffer.from([0x4d, 0x67, 0x76, 0x69])
export const VAULT_IMAGE_VERSION = 1
const SHA256_LEN = 32

export type VaultImageEncodeResult = {
  plaintext: Buffer
  lumaWebpBytes: number
  chromaPngBytes: number
  originalSha256: Buffer
}

export class VaultImagePipeline {
  /**
   * magic (4) | version u8 | lenLuma be32 | lenChroma be32 | lumaWebp | chromaPng | sha256(input)
   */
  static async encodeToPlaintextBlob(
    input: Buffer | Uint8Array,
    options?: { lumaQuality?: number }
  ): Promise<VaultImageEncodeResult> {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
    const q = options?.lumaQuality ?? 78

    const lumaBuf = await sharp(buf)
      .rotate()
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .grayscale()
      .webp({ quality: q, effort: 4 })
      .toBuffer()

    const chromaBuf = await VaultImagePipeline.chromaPngFrom(buf)

    return VaultImagePipeline.packPlaintext(buf, lumaBuf, chromaBuf)
  }

  private static async chromaPngFrom(buf: Buffer): Promise<Buffer> {
    return sharp(buf)
      .rotate()
      .resize(60, 45, { fit: 'fill' })
      .png({ compressionLevel: 9 })
      .toBuffer()
  }

  /**
   * Sucht eine WebP-Qualität, damit die Luma-Schicht unter targetLumaBytes bleibt (Default = Messenger-Blob-Deckel).
   */
  static async encodeToPlaintextBlobFitLuma(
    input: Buffer | Uint8Array,
    targetLumaBytes = MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES
  ): Promise<VaultImageEncodeResult & { usedQuality: number }> {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
    const chromaBuf = await VaultImagePipeline.chromaPngFrom(buf)
    let best!: VaultImageEncodeResult
    let usedQ = 78
    for (let q = 85; q >= 55; q -= 3) {
      const lumaBuf = await sharp(buf)
        .rotate()
        .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
        .grayscale()
        .webp({ quality: q, effort: 4 })
        .toBuffer()
      best = VaultImagePipeline.packPlaintext(buf, lumaBuf, chromaBuf)
      usedQ = q
      if (lumaBuf.length <= targetLumaBytes) break
    }
    return { ...best, usedQuality: usedQ }
  }

  /**
   * **Nur IOTA / Online:** ein Blob `MORG_COMPACT_IMG_V1` (Luma-WebP + Chroma-PNG). **LoRa** nutzt
   * `prepareImageForLoRa` – nicht diese Funktion.
   *
   * Strategie: **Qualität zuerst** (äußere Schleife `q` hoch→runter), innen alle Auflösungs-/Chroma-Presets.
   * So wird nicht zuerst eine riesige Luma mit mieser Qualität gewählt, wenn eine kleinere Kante mit hohem `q`
   * besser aussieht. Chroma-Karten für Online großzügiger als die LoRa-„Postkarten“-Budgets.
   */
  static async encodeToPlaintextBlobFitChain(
    input: Buffer | Uint8Array,
    maxPlaintextBytes = MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES
  ): Promise<
    VaultImageEncodeResult & { usedQuality: number; usedMaxDim: number; chromaW: number; chromaH: number }
  > {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
    /** Online: große Luma-Kante + **breite** Chroma-Karte → mehr Farbinformation beim Blend. */
    const presetsXl: { dim: number; cw: number; ch: number }[] = [
      { dim: 2048, cw: 192, ch: 144 },
      { dim: 2048, cw: 176, ch: 132 },
      { dim: 2048, cw: 160, ch: 120 },
      { dim: 1920, cw: 168, ch: 126 },
      { dim: 1920, cw: 144, ch: 108 },
      { dim: 1792, cw: 152, ch: 114 },
      { dim: 1792, cw: 128, ch: 96 },
      { dim: 1664, cw: 128, ch: 96 },
      { dim: 1664, cw: 112, ch: 84 },
      { dim: 1536, cw: 120, ch: 90 },
      { dim: 1536, cw: 104, ch: 78 },
      { dim: 1408, cw: 112, ch: 84 },
      { dim: 1408, cw: 96, ch: 72 },
      { dim: 1280, cw: 104, ch: 78 },
      { dim: 1280, cw: 88, ch: 66 },
    ]
    const presetsHighColor: { dim: number; cw: number; ch: number }[] = [
      { dim: 1024, cw: 96, ch: 72 },
      { dim: 1024, cw: 88, ch: 66 },
      { dim: 960, cw: 88, ch: 66 },
      { dim: 960, cw: 80, ch: 60 },
      { dim: 896, cw: 80, ch: 60 },
      { dim: 896, cw: 72, ch: 54 },
      { dim: 840, cw: 72, ch: 54 },
      { dim: 840, cw: 64, ch: 48 },
      { dim: 768, cw: 64, ch: 48 },
      { dim: 768, cw: 56, ch: 42 },
      { dim: 720, cw: 56, ch: 42 },
      { dim: 720, cw: 52, ch: 39 },
    ]
    const presetsBase: { dim: number; cw: number; ch: number }[] = [
      { dim: 720, cw: 48, ch: 36 },
      { dim: 720, cw: 40, ch: 30 },
      { dim: 560, cw: 36, ch: 27 },
      { dim: 560, cw: 32, ch: 24 },
      { dim: 448, cw: 32, ch: 24 },
      { dim: 448, cw: 28, ch: 21 },
      { dim: 384, cw: 28, ch: 21 },
      { dim: 384, cw: 24, ch: 18 },
      { dim: 320, cw: 24, ch: 18 },
      { dim: 320, cw: 20, ch: 15 },
      { dim: 256, cw: 20, ch: 15 },
      { dim: 256, cw: 16, ch: 12 },
      { dim: 200, cw: 16, ch: 12 },
      { dim: 200, cw: 14, ch: 10 },
      { dim: 176, cw: 14, ch: 10 },
      { dim: 176, cw: 12, ch: 9 },
      { dim: 160, cw: 12, ch: 9 },
      { dim: 160, cw: 10, ch: 8 },
    ]
    const presets =
      maxPlaintextBytes >= 55_000
        ? [...presetsXl, ...presetsHighColor, ...presetsBase]
        : maxPlaintextBytes >= 10_400
          ? [...presetsHighColor, ...presetsBase]
          : presetsBase

    /** Pro Preset: Chroma einmal; Luma pro Qualitätsstufe (höchstes passendes q zuerst). */
    const webpEffort = 5
    for (const { dim, cw, ch } of presets) {
      const chromaBuf = await sharp(buf)
        .rotate()
        .resize(cw, ch, { fit: 'fill' })
        .png({ compressionLevel: 9 })
        .toBuffer()
      for (let q = 88; q >= 28; q -= 2) {
        const lumaBuf = await sharp(buf)
          .rotate()
          .resize({ width: dim, height: dim, fit: 'inside', withoutEnlargement: true })
          .grayscale()
          .webp({ quality: q, effort: webpEffort })
          .toBuffer()
        const packed = VaultImagePipeline.packPlaintext(buf, lumaBuf, chromaBuf)
        if (packed.plaintext.length <= maxPlaintextBytes) {
          return {
            ...packed,
            usedQuality: q,
            usedMaxDim: dim,
            chromaW: cw,
            chromaH: ch,
          }
        }
      }
    }
    throw new Error(
      `vault-image: Bild nicht unter ${maxPlaintextBytes} B Blob bringbar (Move pure-arg ~16 KiB). Anderes Motiv oder kleinere Datei.`
    )
  }

  private static packPlaintext(
    original: Buffer,
    lumaBuf: Buffer,
    chromaBuf: Buffer
  ): VaultImageEncodeResult {
    const originalSha256 = createHash('sha256').update(original).digest()
    const lenL = Buffer.allocUnsafe(4)
    lenL.writeUInt32BE(lumaBuf.length, 0)
    const lenC = Buffer.allocUnsafe(4)
    lenC.writeUInt32BE(chromaBuf.length, 0)
    const plaintext = Buffer.concat([
      VAULT_IMAGE_MAGIC,
      Buffer.from([VAULT_IMAGE_VERSION]),
      lenL,
      lenC,
      lumaBuf,
      chromaBuf,
      originalSha256,
    ])
    return {
      plaintext,
      lumaWebpBytes: lumaBuf.length,
      chromaPngBytes: chromaBuf.length,
      originalSha256,
    }
  }

  /** Liest Header; wirft bei ungültigem Magic/Version/Längen. */
  static parsePlaintextHeader(blob: Buffer): {
    luma: Buffer
    chroma: Buffer
    originalSha256: Buffer
    restOffset: number
  } {
    if (blob.length < 4 + 1 + 4 + 4 + SHA256_LEN) throw new Error('vault-image: blob zu kurz')
    let o = 0
    if (!blob.subarray(0, 4).equals(VAULT_IMAGE_MAGIC)) throw new Error('vault-image: falsches magic')
    o += 4
    if (blob[o] !== VAULT_IMAGE_VERSION) throw new Error('vault-image: unsupported version')
    o += 1
    const lenL = blob.readUInt32BE(o)
    o += 4
    const lenC = blob.readUInt32BE(o)
    o += 4
    const need = o + lenL + lenC + SHA256_LEN
    if (blob.length < need) throw new Error('vault-image: Längen passen nicht zum Buffer')
    const luma = blob.subarray(o, o + lenL)
    o += lenL
    const chroma = blob.subarray(o, o + lenC)
    o += lenC
    const originalSha256 = blob.subarray(o, o + SHA256_LEN)
    o += SHA256_LEN
    return { luma, chroma, originalSha256, restOffset: o }
  }

  /**
   * Rekonstruktion wie im Browser-Canvas (Luma-WebP + Chroma-PNG, Blend „colour“).
   * Fallback: nur Luma als PNG, falls Composite nicht unterstützt oder fehlschlägt.
   */
  static async reconstructBlendToPng(blob: Buffer): Promise<Buffer> {
    const { luma, chroma } = VaultImagePipeline.parsePlaintextHeader(blob)
    const lumaMeta = await sharp(luma).metadata()
    const w = lumaMeta.width ?? 1
    const h = lumaMeta.height ?? 1
    const chromaPng = await sharp(chroma).resize(w, h, { fit: 'fill' }).png().toBuffer()
    let raw: Buffer
    try {
      raw = await sharp(luma)
        .ensureAlpha()
        // libvips blend „colour“ (wie Canvas globalCompositeOperation ‚color‘)
        .composite([{ input: chromaPng, blend: 'colour' as import('sharp').Blend }])
        .png()
        .toBuffer()
    } catch {
      raw = await sharp(luma).png().toBuffer()
    }
    // Zweiter Pass: garantiert dekodierbares PNG für `<img>` / Canvas (manche libvips-Ausgaben sind für Browser zu „exotisch“).
    return sharp(raw).png({ compressionLevel: 6 }).toBuffer()
  }
}
