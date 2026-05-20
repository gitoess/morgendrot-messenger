/**
 * Mehrere Anhänge in einem .morg-pkg-Klartext (vor ECDH): JSON-Bundle.
 * Entschlüsselung liefert wie bisher einen String; Parser erkennt schema und expandiert in der UI.
 */
import {
  MEDIA_IOTA_AUDIO_RAW_MAX_BYTES,
  morgAudioWirePassesLimits,
  wireUtf8ByteLength,
  wrapCompactImageMessage,
  wrapFileTxtMessage,
  wrapMorgAudioV1Message,
} from '@/frontend/lib/compact-image-wire'
import { MESSAGING_ONLINE_WIRE_UTF8_MAX, MORG_PKG_BUNDLE_MAX_UTF8_BYTES } from '@/frontend/lib/morg-pkg-limits'

export const MORG_PKG_BUNDLE_SCHEMA = 'morgendrot.morgpkg.bundle.v1' as const

export type MorgPkgBundleItem =
  | { kind: 'compact_image'; caption?: string; wire: string }
  | { kind: 'file_txt'; wire: string }
  | { kind: 'opus'; wire: string }
  | { kind: 'text'; text: string }

export type MorgPkgBundleV1 = {
  schema: typeof MORG_PKG_BUNDLE_SCHEMA
  version: 1
  createdAtMs: number
  note?: string
  items: MorgPkgBundleItem[]
}

export function bundleItemToWireContent(item: MorgPkgBundleItem): string {
  if (item.kind === 'text') return item.text
  if (item.kind === 'compact_image') {
    const cap = item.caption?.trim()
    return cap ? `${item.wire}\n\n${cap}` : item.wire
  }
  return item.wire
}

export function tryParseMorgPkgBundle(plaintext: string): MorgPkgBundleV1 | null {
  const t = plaintext.trimStart()
  if (!t.startsWith('{')) return null
  try {
    const o = JSON.parse(plaintext) as Record<string, unknown>
    if (o.schema !== MORG_PKG_BUNDLE_SCHEMA || o.version !== 1 || !Array.isArray(o.items)) return null
    return o as MorgPkgBundleV1
  } catch {
    return null
  }
}

export function serializeMorgPkgBundle(b: MorgPkgBundleV1): string {
  return JSON.stringify(b)
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Datei lesen fehlgeschlagen'))
    r.readAsDataURL(file)
  })
}

export type CompactImageEncodeFn = (imageBase64: string) => Promise<{
  ok: boolean
  blobBase64?: string
  error?: string
}>

export async function buildMorgPkgBundleFromFiles(
  files: FileList | readonly File[],
  compactImageEncode: CompactImageEncodeFn
): Promise<{ ok: true; plaintext: string; itemCount: number } | { ok: false; error: string }> {
  const items: MorgPkgBundleItem[] = []
  const list = Array.from(files)
  for (const f of list) {
    const name = f.name || 'datei'
    const isTxt = f.type === 'text/plain' || /\.txt$/i.test(name)
    const isImg = f.type.startsWith('image/')
    const isOpus =
      /\.opus$/i.test(name) ||
      f.type === 'audio/ogg' ||
      f.type === 'audio/opus' ||
      f.type === 'application/ogg'

    if (isImg) {
      const dataUrl = await readFileAsDataUrl(f)
      const enc = await compactImageEncode(dataUrl)
      if (!enc.ok || !enc.blobBase64) {
        return { ok: false, error: enc.error || `Bild „${name}“: Kodierung fehlgeschlagen.` }
      }
      items.push({ kind: 'compact_image', wire: wrapCompactImageMessage(enc.blobBase64, '') })
    } else if (isTxt) {
      const text = await f.text()
      items.push({ kind: 'file_txt', wire: wrapFileTxtMessage(name, text, '') })
    } else if (isOpus) {
      const buf = await f.arrayBuffer()
      const u8 = new Uint8Array(buf)
      const magic = String.fromCharCode(u8[0] || 0, u8[1] || 0, u8[2] || 0, u8[3] || 0)
      if (u8.length < 4 || magic !== 'OggS') {
        return { ok: false, error: `„${name}“: Kein Ogg-Container (Magic OggS).` }
      }
      if (u8.length > MEDIA_IOTA_AUDIO_RAW_MAX_BYTES) {
        return {
          ok: false,
          error: `„${name}“: Opus zu groß (${u8.length} B, max. ${MEDIA_IOTA_AUDIO_RAW_MAX_BYTES} B für Online-Paket).`,
        }
      }
      let bin = ''
      for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]!)
      const b64 = btoa(bin)
      const wire = wrapMorgAudioV1Message(b64, '')
      const lim = morgAudioWirePassesLimits(wire)
      if (!lim.ok) return { ok: false, error: `„${name}“: ${lim.reason}` }
      items.push({ kind: 'opus', wire })
    } else if (f.type === 'application/pdf' || /\.pdf$/i.test(name)) {
      return {
        ok: false,
        error: `PDF „${name}“: im Offline-Bundle nicht unterstützt (Bilder, .txt, Opus).`,
      }
    } else {
      return { ok: false, error: `Nicht unterstützt: „${name}“ (${f.type || '?'})` }
    }
  }

  if (items.length === 0) {
    return { ok: false, error: 'Keine Dateien ausgewählt.' }
  }

  const bundle: MorgPkgBundleV1 = {
    schema: MORG_PKG_BUNDLE_SCHEMA,
    version: 1,
    createdAtMs: Date.now(),
    items,
  }
  const plaintext = serializeMorgPkgBundle(bundle)
  const n = wireUtf8ByteLength(plaintext)
  if (n > MORG_PKG_BUNDLE_MAX_UTF8_BYTES) {
    const mb = Math.round(MORG_PKG_BUNDLE_MAX_UTF8_BYTES / 1024)
    return {
      ok: false,
      error: `Sneakernet-Paket zu groß (${n} B UTF-8, max. ${mb} KiB / ${MORG_PKG_BUNDLE_MAX_UTF8_BYTES} B). Weniger Dateien oder kleinere Bilder. Hinweis: Einzelversand über IOTA bleibt bei ~${MESSAGING_ONLINE_WIRE_UTF8_MAX} B pro Nachricht.`,
    }
  }
  return { ok: true, plaintext, itemCount: items.length }
}
