/**
 * Rekonstruktion: Graustufen-WebP (scharf) + hochskalierte Farb-PNG, Canvas blend mode "color"
 * (Helligkeit vom Untergrund, Farbton/Sättigung vom überlagerten Bild).
 */
const MAGIC = new Uint8Array([0x4d, 0x67, 0x76, 0x69])
const VERSION = 1
const SHA256_LEN = 32

const HEADER_TAIL = 4 + 1 + 4 + 4 /** Magic + version + lenL + lenC */

function readCompactBlobHeader(buf: Uint8Array): { lenL: number; lenC: number; payloadStart: number } | null {
  if (buf.length < HEADER_TAIL) return null
  for (let i = 0; i < 4; i++) if (buf[i] !== MAGIC[i]) return null
  let o = 4
  if (buf[o] !== VERSION) return null
  o += 1
  const lenL = (buf[o] << 24) | (buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3]
  o += 4
  const lenC = (buf[o] << 24) | (buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3]
  o += 4
  if (!Number.isFinite(lenL) || lenL < 1 || lenL > 20_000_000) return null
  if (!Number.isFinite(lenC) || lenC < 0 || lenC > 20_000_000) return null
  return { lenL, lenC, payloadStart: o }
}

/**
 * Wenn der Netto-Blob **nach vollständigem Luma-WebP** abbricht (fehlendes Chroma/SHA), Luma-Bytes zurückgeben.
 * Voller Blob → `null` (normale strikte Parser-Pipeline).
 */
export function tryExtractTruncatedCompactLumaWebp(buf: Uint8Array): Uint8Array | null {
  const h = readCompactBlobHeader(buf)
  if (!h) return null
  const { lenL, lenC, payloadStart: o } = h
  const need = o + lenL + lenC + SHA256_LEN
  if (buf.length >= need) return null
  if (buf.length < o + lenL) return null
  return buf.subarray(o, o + lenL)
}

export function parseCompactImageBlob(buf: Uint8Array): {
  luma: Uint8Array
  chroma: Uint8Array
  originalSha256: Uint8Array
} {
  if (buf.length < 4 + 1 + 4 + 4 + SHA256_LEN) throw new Error('compact-image: Buffer zu kurz')
  let o = 0
  for (let i = 0; i < 4; i++) if (buf[i] !== MAGIC[i]) throw new Error('compact-image: ungültiges Magic')
  o = 4
  if (buf[o] !== VERSION) throw new Error('compact-image: unsupported version')
  o += 1
  const lenL = (buf[o] << 24) | (buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3]
  o += 4
  const lenC = (buf[o] << 24) | (buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3]
  o += 4
  const need = o + lenL + lenC + SHA256_LEN
  if (buf.length < need || lenL < 0 || lenC < 0) throw new Error('compact-image: Längen ungültig')
  const luma = buf.subarray(o, o + lenL)
  o += lenL
  const chroma = buf.subarray(o, o + lenC)
  o += lenC
  const originalSha256 = buf.subarray(o, o + SHA256_LEN)
  return { luma, chroma, originalSha256 }
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export type CompactImageReconstructMeta = { dataUrl: string; incomplete: boolean }

async function compactLumaWebpToDataUrl(luma: Uint8Array): Promise<string> {
  const lumaBmp = await createImageBitmap(new Blob([luma], { type: 'image/webp' }))
  try {
    const w = lumaBmp.width
    const h = lumaBmp.height
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('compact-image: kein 2D-Context')
    ctx.drawImage(lumaBmp, 0, 0)
    return canvas.toDataURL('image/png')
  } finally {
    lumaBmp.close()
  }
}

async function blendLumaChromaToDataUrl(luma: Uint8Array, chroma: Uint8Array): Promise<string> {
  const lumaBmp = await createImageBitmap(new Blob([luma], { type: 'image/webp' }))
  const chromaBmp = await createImageBitmap(new Blob([chroma], { type: 'image/png' }))
  try {
    const w = lumaBmp.width
    const h = lumaBmp.height
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('compact-image: kein 2D-Context')

    ctx.drawImage(lumaBmp, 0, 0)
    ctx.globalCompositeOperation = 'color'
    ctx.drawImage(chromaBmp, 0, 0, w, h)
    ctx.globalCompositeOperation = 'source-over'

    return canvas.toDataURL('image/png')
  } finally {
    lumaBmp.close()
    chromaBmp.close()
  }
}

/** Volle Rekonstruktion oder Luma-only bei abgeschnittenem Blob / leerem Chroma / defektem Chroma (§ H.6c). */
export async function reconstructCompactImageToDataUrlWithMeta(blobBase64: string): Promise<CompactImageReconstructMeta> {
  const u8 = base64ToUint8Array(blobBase64)
  try {
    const parsed = parseCompactImageBlob(u8)
    if (parsed.chroma.length === 0) {
      const dataUrl = await compactLumaWebpToDataUrl(parsed.luma)
      return { dataUrl, incomplete: true }
    }
    try {
      const dataUrl = await blendLumaChromaToDataUrl(parsed.luma, parsed.chroma)
      return { dataUrl, incomplete: false }
    } catch {
      const dataUrl = await compactLumaWebpToDataUrl(parsed.luma)
      return { dataUrl, incomplete: true }
    }
  } catch (e) {
    const trunc = tryExtractTruncatedCompactLumaWebp(u8)
    if (trunc && trunc.length > 0) {
      const dataUrl = await compactLumaWebpToDataUrl(trunc)
      return { dataUrl, incomplete: true }
    }
    throw e instanceof Error ? e : new Error(String(e))
  }
}

export async function reconstructCompactImageToDataUrl(blobBase64: string): Promise<string> {
  const r = await reconstructCompactImageToDataUrlWithMeta(blobBase64)
  return r.dataUrl
}
