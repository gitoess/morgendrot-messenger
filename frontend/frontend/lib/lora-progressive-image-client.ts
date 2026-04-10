/**
 * LoRa progressives Bild (Browser): Parser + Fusion.
 * Standard: Backend `POST /api/lora-progressive-fuse` (sharp `composite` blend `over`).
 * Fallback ohne API: Canvas `color` (heuristisch).
 */
import type { Message } from '@/frontend/lib/types'
import { loraProgressiveFuse } from '@/frontend/lib/api'
import { normalizeMessengerWireContent } from '@/frontend/lib/compact-image-wire'
import { uint8ArrayToBase64 } from '@/frontend/lib/emergency-binary-browser'

export const LORA_LUMA_WIRE_PREFIX = '[[MORG_LUMA_V1:' as const
export const LORA_CHROMA_WIRE_PREFIX = '[[MORG_CHROMA_V1:' as const

/** Nach S/W: Warten auf Chroma, dann klare Fehlermeldung (Policy). */
export const LORA_CHROMA_WAIT_MS = 60_000

export type ParsedLoraWireKind = 'luma' | 'chroma'

export type ParsedLoraProgressiveMessage = {
  kind: ParsedLoraWireKind
  msgId: string
  jpeg: Uint8Array
  caption?: string
}

function splitProgressiveWire(t: string): {
  prefix: typeof LORA_LUMA_WIRE_PREFIX | typeof LORA_CHROMA_WIRE_PREFIX
  wire: string
  caption: string
} | null {
  for (const prefix of [LORA_LUMA_WIRE_PREFIX, LORA_CHROMA_WIRE_PREFIX] as const) {
    if (!t.startsWith(prefix)) continue
    const s = t.slice(prefix.length)
    const re = /^msgId=([a-f0-9]{8})\|len=(\d+)\|/
    const m = re.exec(s)
    if (!m) continue
    const len = parseInt(m[2]!, 10)
    if (!Number.isFinite(len) || len < 1 || len > 20_000_000) continue
    const hdrLen = prefix.length + m[0].length
    const endWire = hdrLen + len + 2
    if (t.length < endWire) continue
    if (t.slice(hdrLen + len, endWire) !== ']]') continue
    const wire = t.slice(0, endWire)
    const caption = t.slice(endWire).replace(/^\s*\n\s*/, '').trim()
    return { prefix, wire, caption }
  }
  return null
}

/**
 * Voller Nachrichtentext: Wire + optional Caption nach `]]`.
 * `len` = Zeichenlänge Base64-Payload (wie Server).
 */
export function parseLoraProgressiveMessage(content: string): ParsedLoraProgressiveMessage | null {
  const t = normalizeMessengerWireContent(content)
  const sp = splitProgressiveWire(t)
  if (!sp) return null
  const s = sp.wire.slice(sp.prefix.length)
  const re = /^msgId=([a-f0-9]{8})\|len=(\d+)\|/
  const m = re.exec(s)
  if (!m) return null
  const msgId = m[1]!
  const len = parseInt(m[2]!, 10)
  const payload = s.slice(m[0].length, m[0].length + len)
  if (payload.length !== len) return null
  let jpeg: Uint8Array
  try {
    const bin = atob(payload.replace(/\s/g, ''))
    jpeg = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) jpeg[i] = bin.charCodeAt(i)
  } catch {
    return null
  }
  if (jpeg.length < 16) return null
  const kind: ParsedLoraWireKind = sp.prefix === LORA_LUMA_WIRE_PREFIX ? 'luma' : 'chroma'
  return { kind, msgId, jpeg, caption: sp.caption || undefined }
}

export function uint8ToObjectUrl(u8: Uint8Array, mime: string = 'image/jpeg'): string {
  return URL.createObjectURL(new Blob([u8], { type: mime }))
}

export function revokeObjectUrlSafe(u: string | null): void {
  if (u) URL.revokeObjectURL(u)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('JPEG-Dekodierung fehlgeschlagen'))
    img.src = src
  })
}

/** Zuerst sharp-Fusion über API; bei Fehler/Ausfall Canvas-Fusion. */
export async function fuseLoraProgressivePreferSharpBackend(
  luma: Uint8Array,
  chroma: Uint8Array
): Promise<string> {
  try {
    const r = await loraProgressiveFuse(uint8ArrayToBase64(luma), uint8ArrayToBase64(chroma))
    if (r.ok === true && typeof r.fusedJpegBase64 === 'string' && r.fusedJpegBase64.length > 0) {
      return `data:image/jpeg;base64,${r.fusedJpegBase64}`
    }
  } catch {
    /* Backend nicht erreichbar */
  }
  return fuseLoraProgressiveJpegsToDataUrl(luma, chroma)
}

/** Heuristische Farbe: Luma-Helligkeit + Chroma-Färbung (Canvas `color`) – Fallback. */
export async function fuseLoraProgressiveJpegsToDataUrl(luma: Uint8Array, chroma: Uint8Array): Promise<string> {
  const u1 = uint8ToObjectUrl(luma)
  const u2 = uint8ToObjectUrl(chroma)
  try {
    const [lumaImg, chromaImg] = await Promise.all([loadImage(u1), loadImage(u2)])
    const w = lumaImg.naturalWidth
    const h = lumaImg.naturalHeight
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Kein 2D-Context')
    ctx.drawImage(lumaImg, 0, 0)
    ctx.globalCompositeOperation = 'color'
    ctx.drawImage(chromaImg, 0, 0, w, h)
    ctx.globalCompositeOperation = 'source-over'
    return canvas.toDataURL('image/jpeg', 0.88)
  } finally {
    URL.revokeObjectURL(u1)
    URL.revokeObjectURL(u2)
  }
}

/** Passendes Chroma zur Luma-Zeile (gleicher Absender, msgId, Zeit ≥ Luma). */
export function findPartnerChromaJpeg(
  inbox: readonly Message[],
  from: string,
  msgId: string,
  lumaTimestamp: number
): Uint8Array | null {
  for (const m of inbox) {
    if (m.from !== from) continue
    const p = parseLoraProgressiveMessage(m.content ?? '')
    if (p?.kind !== 'chroma' || p.msgId !== msgId) continue
    if (m.timestamp + 2_000 < lumaTimestamp) continue
    return p.jpeg
  }
  return null
}

export function downloadUint8AsFile(u8: Uint8Array, fileName: string, mime: string = 'image/jpeg'): void {
  const blob = new Blob([u8], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Download aus data:-URL (z. B. Fusion-JPEG aus Backend). */
export function downloadDataUrlAsFile(dataUrl: string, fileName: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
