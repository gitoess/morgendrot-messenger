/**
 * Rekonstruktion: Graustufen-WebP (scharf) + hochskalierte Farb-PNG, Canvas blend mode "color"
 * (Helligkeit vom Untergrund, Farbton/Sättigung vom überlagerten Bild).
 */
const MAGIC = new Uint8Array([0x4d, 0x67, 0x76, 0x69])
const VERSION = 1
const SHA256_LEN = 32

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

export async function reconstructCompactImageToDataUrl(blobBase64: string): Promise<string> {
  const u8 = base64ToUint8Array(blobBase64)
  const { luma, chroma } = parseCompactImageBlob(u8)

  const lumaBmp = await createImageBitmap(new Blob([luma], { type: 'image/webp' }))
  const chromaBmp = await createImageBitmap(new Blob([chroma], { type: 'image/png' }))

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

  lumaBmp.close()
  chromaBmp.close()

  return canvas.toDataURL('image/png')
}
