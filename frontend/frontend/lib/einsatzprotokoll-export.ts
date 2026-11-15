'use client'

/**
 * Einsatzprotokoll: Im Browser wird zuerst ein echtes ZIP (protokoll.json, protokoll.html, medien/) gebaut,
 * dann AES-GCM-verschlüsselt und als JSON-Datei (*.zip.enc.json) heruntergeladen – kein klassisches „ZIP mit Passwort“.
 * Entschlüsseln: /einsatzbericht-decrypt.html → Download der entpackbaren .zip.
 */

import { strToU8, zipSync } from 'fflate'
import type { Message } from '@/frontend/lib/types'
import {
  normalizeMessengerWireContent,
  parseCompactImageMessage,
  parseFileTxtMessage,
  parseMorgAudioV1Message,
} from '@/frontend/lib/compact-image-wire'
import {
  parseCompactImageBlob,
  reconstructCompactImageToDataUrlWithMeta,
  tryExtractTruncatedCompactLumaWebp,
} from '@/frontend/lib/compact-image-canvas'
import { encryptEinsatzprotokollZipBytes, downloadEinsatzprotokollEncryptedJson } from '@/frontend/lib/einsatzbericht-crypto'

export const EINSATZPROTOKOLL_SCHEMA = 'morgendrot.einsatzprotokoll.v1' as const

export type EinsatzprotokollExportMeta = {
  exportedAt: number
  exportedByAddress?: string
  note: string
}

function resolveTransportCodes(m: Message): ('internet' | 'lan' | 'mesh' | 'adhoc' | 'telegram')[] {
  if (m.transports?.length) return [...m.transports]
  return m.source === 'mesh' ? ['mesh'] : ['internet']
}

function labelForCode(t: string): string {
  switch (t) {
    case 'internet':
      return 'IOTA / Mailbox (Online)'
    case 'lan':
      return 'LAN / Boss-WLAN'
    case 'mesh':
      return 'LoRa / Meshtastic'
    case 'adhoc':
      return 'Bluetooth / Ad-hoc'
    case 'telegram':
      return 'Telegram'
    default:
      return t
  }
}

export function formatTransportSummaryDe(m: Message): { codes: string[]; labelDe: string; isHybrid: boolean } {
  const codes = resolveTransportCodes(m).map(String)
  const labels = [...new Set(codes.map(labelForCode))]
  const isHybrid = labels.length > 1
  if (!isHybrid) {
    return { codes, labelDe: labels[0] ?? 'Unbekannt', isHybrid: false }
  }
  return {
    codes,
    labelDe: `Hybrid: ${labels.join(' → ')}`,
    isHybrid: true,
  }
}

export type EinsatzprotokollPayload = {
  schema: typeof EINSATZPROTOKOLL_SCHEMA
  meta: EinsatzprotokollExportMeta
  messagesChronological: Array<{
    id: string
    from: string
    timestamp: number
    iso: string
    recipient?: string
    encrypted: boolean
    source?: Message['source']
    transports: string[]
    transportSummaryDe: string
    isHybridTransport: boolean
    content: string
    contentLength: number
  }>
}

export function buildEinsatzprotokollPayload(
  messages: Message[],
  meta: { exportedByAddress?: string },
  opts?: { messageIds?: string[] | null }
): EinsatzprotokollPayload {
  let list = [...messages].sort((a, b) => a.timestamp - b.timestamp)
  const ids = opts?.messageIds?.filter(Boolean)
  if (ids?.length) {
    const set = new Set(ids)
    list = list.filter((m) => set.has(m.id))
  }
  return {
    schema: EINSATZPROTOKOLL_SCHEMA,
    meta: {
      exportedAt: Date.now(),
      exportedByAddress: meta.exportedByAddress,
      note:
        'Transport wie in der lokalen Inbox (Hybrid möglich). Sneakernet/.morg-pkg kann wie Online erscheinen.',
    },
    messagesChronological: list.map((m) => {
      const { codes, labelDe, isHybrid } = formatTransportSummaryDe(m)
      return {
        id: m.id,
        from: m.from,
        timestamp: m.timestamp,
        iso: new Date(m.timestamp).toISOString(),
        recipient: m.recipient,
        encrypted: m.encrypted === true,
        source: m.source,
        transports: codes,
        transportSummaryDe: labelDe,
        isHybridTransport: isHybrid,
        content: m.content ?? '',
        contentLength: (m.content ?? '').length,
      }
    }),
  }
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildEinsatzprotokollHtml(payload: EinsatzprotokollPayload): string {
  const title = `Einsatzprotokoll – ${new Date(payload.meta.exportedAt).toLocaleString('de-DE')}`
  const rows = payload.messagesChronological
    .map((m) => {
      const prev =
        m.content.length > 4000 ? `${escHtml(m.content.slice(0, 4000))}…` : escHtml(m.content)
      return `<tr>
  <td class="t">${escHtml(m.iso)}</td>
  <td class="f">${escHtml(m.from)}</td>
  <td class="tr">${escHtml(m.transportSummaryDe)}</td>
  <td class="c"><pre>${prev || '(leer)'}</pre></td>
</tr>`
    })
    .join('\n')
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 1rem; line-height: 1.45; }
    h1 { font-size: 1.1rem; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; vertical-align: top; }
    th { background: #f4f4f4; text-align: left; }
    td.t { white-space: nowrap; font-variant-numeric: tabular-nums; }
    td.f { word-break: break-all; max-width: 12rem; }
    td.tr { max-width: 14rem; }
    td.c pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, monospace; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${escHtml(title)}</h1>
  <p>Nachrichten: ${payload.messagesChronological.length}</p>
  <table>
    <thead>
      <tr><th>Zeit (ISO)</th><th>Absender</th><th>Transport</th><th>Inhalt</th></tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</body>
</html>
`
}

type ExtractedMedia = { path: string; bytes: Uint8Array; kind: MorgMediaKind }

/** Auswahl für „nur Medien“-Export. */
export type MorgMediaKind = 'audio' | 'photo' | 'image' | 'file' | 'text' | 'slide'

export type MorgMediaKindFilter = Partial<Record<MorgMediaKind, boolean>>

export function morgMediaKindForTag(tag: string): MorgMediaKind {
  if (tag === 'MORG_AUDIO_V1') return 'audio'
  /** Funk-Luma/Chroma und Online-Compact → eine Kategorie „Bilder“. */
  if (tag === 'MORG_LUMA_V1' || tag === 'MORG_CHROMA_V1' || tag === 'MORG_COMPACT_IMG_V1') return 'image'
  if (tag === 'MORG_FILE_TXT_V1') return 'file'
  if (tag === 'MORG_TXT_V1') return 'text'
  if (tag.startsWith('MORG_SLIDE')) return 'slide'
  return 'file'
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Magic-Bytes → nutzbare Endung (kein .bin für JPEG/PNG/WebP/Ogg). */
export function sniffMediaExt(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png'
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp'
  }
  if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return 'ogg'
  }
  return 'bin'
}

function safeZipStem(name: string, max = 64): string {
  const base = String(name || 'datei')
    .replace(/[/\\?%*:|"<>]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '')
    .trim()
  const n = base || 'datei'
  return n.length > max ? n.slice(0, max) : n
}

function kindAllowed(kind: MorgMediaKind, filter?: MorgMediaKindFilter | null): boolean {
  if (!filter) return true
  if (filter[kind] === true) return true
  /** Abwärts: altes „photo“-Häkchen gilt für Bilder. */
  if (kind === 'image' && filter.photo === true) return true
  return false
}

async function dataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
  const res = await fetch(dataUrl)
  return new Uint8Array(await res.arrayBuffer())
}

/** Compact-Wire → PNG (Anzeigeformat); Fallback Luma-WebP / Rohbytes. */
async function compactBlobToExportFile(
  blobBase64: string
): Promise<{ bytes: Uint8Array; ext: string }> {
  try {
    const recon = await reconstructCompactImageToDataUrlWithMeta(blobBase64)
    if (recon.dataUrl) {
      const bytes = await dataUrlToBytes(recon.dataUrl)
      const sniffed = sniffMediaExt(bytes)
      return { bytes, ext: sniffed === 'bin' ? 'png' : sniffed }
    }
  } catch {
    /* Fallback unten */
  }
  const raw = b64ToBytes(blobBase64)
  try {
    const parsed = parseCompactImageBlob(raw)
    if (parsed.luma.length > 0) {
      return { bytes: parsed.luma, ext: sniffMediaExt(parsed.luma) === 'bin' ? 'webp' : sniffMediaExt(parsed.luma) }
    }
  } catch {
    /* ignore */
  }
  const trunc = tryExtractTruncatedCompactLumaWebp(raw)
  if (trunc && trunc.length > 0) {
    return { bytes: trunc, ext: sniffMediaExt(trunc) === 'bin' ? 'webp' : sniffMediaExt(trunc) }
  }
  return { bytes: raw, ext: sniffMediaExt(raw) }
}

/**
 * Medien aus Wire-Nachrichten — nutzbare Dateien (png/jpg/webp/ogg/txt), keine .bin-Container.
 */
export async function extractMorgMediaFromMessages(
  messages: Message[],
  opts?: { kinds?: MorgMediaKindFilter | null }
): Promise<ExtractedMedia[]> {
  const out: ExtractedMedia[] = []
  const chronological = [...messages].sort((a, b) => a.timestamp - b.timestamp)
  let mediaIdx = 0
  const usedNames = new Set<string>()

  const pushUnique = (path: string, bytes: Uint8Array, kind: MorgMediaKind) => {
    let p = path
    if (usedNames.has(p)) {
      const dot = p.lastIndexOf('.')
      const stem = dot > 0 ? p.slice(0, dot) : p
      const ext = dot > 0 ? p.slice(dot) : ''
      p = `${stem}-${mediaIdx}${ext}`
    }
    usedNames.add(p)
    out.push({ path: p, bytes, kind })
  }

  for (let mi = 0; mi < chronological.length; mi++) {
    const m = chronological[mi]!
    const raw = normalizeMessengerWireContent(m.content ?? '')
    if (!raw.includes('[[MORG_')) continue
    const msgNo = mi + 1
    let handledCompact = false
    let handledAudio = false
    let handledFileTxt = false

    if (kindAllowed('image', opts?.kinds)) {
      const img = parseCompactImageMessage(raw)
      if (img?.blobBase64) {
        try {
          const file = await compactBlobToExportFile(img.blobBase64)
          pushUnique(`medien/msg-${msgNo}-bild-${mediaIdx++}.${file.ext}`, file.bytes, 'image')
          handledCompact = true
        } catch {
          /* Tag-Scan unten */
        }
      }
    }

    if (kindAllowed('audio', opts?.kinds)) {
      const audio = parseMorgAudioV1Message(raw)
      if (audio?.blobBase64) {
        try {
          const bytes = b64ToBytes(audio.blobBase64)
          const ext = sniffMediaExt(bytes) === 'ogg' ? 'ogg' : 'opus'
          pushUnique(`medien/msg-${msgNo}-audio-${mediaIdx++}.${ext}`, bytes, 'audio')
          handledAudio = true
        } catch {
          /* Tag-Scan */
        }
      }
    }

    if (kindAllowed('file', opts?.kinds)) {
      const fileTxt = parseFileTxtMessage(raw)
      if (fileTxt) {
        const name = safeZipStem(fileTxt.fileName.endsWith('.txt') ? fileTxt.fileName : `${fileTxt.fileName}.txt`)
        pushUnique(`medien/msg-${msgNo}-${name}`, strToU8(fileTxt.text), 'file')
        handledFileTxt = true
        mediaIdx++
      }
    }

    let i = 0
    while (true) {
      const a = raw.indexOf('[[MORG_', i)
      if (a === -1) break
      const colon = raw.indexOf(':', a + 2)
      if (colon === -1) break
      const tag = raw.slice(a + 2, colon)
      const end = raw.indexOf(']]', colon + 1)
      if (end === -1) break
      const payload = raw.slice(colon + 1, end).replace(/\s/g, '')
      i = end + 2
      if (!payload.length) continue
      const kind = morgMediaKindForTag(tag)
      if (!kindAllowed(kind, opts?.kinds)) continue
      if (tag === 'MORG_COMPACT_IMG_V1' && handledCompact) continue
      if (tag === 'MORG_AUDIO_V1' && handledAudio) continue
      if (tag === 'MORG_FILE_TXT_V1' && handledFileTxt) continue

      try {
        if (tag === 'MORG_TXT_V1') {
          const txt = new TextDecoder().decode(b64ToBytes(payload))
          pushUnique(`medien/msg-${msgNo}-txt-${mediaIdx++}.txt`, strToU8(txt), kind)
          continue
        }
        if (tag === 'MORG_FILE_TXT_V1') {
          continue
        }
        if (tag === 'MORG_COMPACT_IMG_V1') {
          const file = await compactBlobToExportFile(payload)
          pushUnique(`medien/msg-${msgNo}-bild-${mediaIdx++}.${file.ext}`, file.bytes, kind)
          continue
        }
        if (tag === 'MORG_AUDIO_V1') {
          const bytes = b64ToBytes(payload)
          const ext = sniffMediaExt(bytes) === 'ogg' ? 'ogg' : 'opus'
          pushUnique(`medien/msg-${msgNo}-audio-${mediaIdx++}.${ext}`, bytes, kind)
          continue
        }
        if (tag === 'MORG_LUMA_V1' || tag === 'MORG_CHROMA_V1') {
          const bytes = b64ToBytes(payload)
          const ext = sniffMediaExt(bytes) === 'bin' ? 'jpg' : sniffMediaExt(bytes)
          const layer = tag === 'MORG_LUMA_V1' ? 'luma' : 'chroma'
          pushUnique(`medien/msg-${msgNo}-${layer}-${mediaIdx++}.${ext}`, bytes, kind)
          continue
        }
        if (tag.startsWith('MORG_SLIDE')) {
          const bytes = b64ToBytes(payload)
          const ext = sniffMediaExt(bytes)
          pushUnique(
            `medien/msg-${msgNo}-slide-${mediaIdx++}.${ext === 'bin' ? 'part' : ext}`,
            bytes,
            kind
          )
          continue
        }
        const bytes = b64ToBytes(payload)
        const ext = sniffMediaExt(bytes)
        pushUnique(
          `medien/msg-${msgNo}-${tag.replace(/^MORG_/, '').toLowerCase()}-${mediaIdx++}.${ext}`,
          bytes,
          kind
        )
      } catch {
        /* ungültig */
      }
    }
  }
  return out
}

function mimeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'ogg':
    case 'opus':
      return 'audio/ogg'
    case 'txt':
      return 'text/plain;charset=utf-8'
    default:
      return 'application/octet-stream'
  }
}

function downloadBytesAsFile(bytes: Uint8Array, filename: string, mime: string) {
  const blob = new Blob([bytes], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export type MorgMediaListItem = {
  id: string
  kind: MorgMediaKind
  label: string
  filename: string
  bytes: Uint8Array
  sizeLabel: string
}

/** Medienliste für Auswahl-UI (Bilder / Audio / Dateien / …). */
export async function listMorgMediaForExport(
  messages: Message[],
  opts?: { kinds?: MorgMediaKindFilter | null }
): Promise<MorgMediaListItem[]> {
  const media = await extractMorgMediaFromMessages(messages, opts)
  return media.map((m, i) => {
    const filename = m.path.replace(/^medien\//, '')
    const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.') + 1) : 'bin'
    const kindLabel =
      m.kind === 'image' || m.kind === 'photo'
        ? 'Bild'
        : m.kind === 'audio'
          ? 'Audio'
          : m.kind === 'file'
            ? 'Datei'
            : m.kind === 'text'
              ? 'Text'
              : m.kind === 'slide'
                ? 'Slide'
                : m.kind
    return {
      id: `${m.kind}-${i}-${filename}`,
      kind: m.kind,
      label: `${kindLabel}: ${filename}`,
      filename,
      bytes: m.bytes,
      sizeLabel: `${Math.max(1, Math.round(m.bytes.length / 1024))} KB`,
    }
  })
}

/** Bereits gelistete Medien speichern (Auswahl per id). */
export async function downloadMorgMediaListItems(
  items: MorgMediaListItem[],
  ids?: string[] | null
): Promise<{ count: number }> {
  let list = items
  if (ids?.length) {
    const set = new Set(ids)
    list = items.filter((x) => set.has(x.id))
  }
  if (list.length === 0) return { count: 0 }
  for (let i = 0; i < list.length; i++) {
    const it = list[i]!
    const ext = it.filename.includes('.') ? it.filename.slice(it.filename.lastIndexOf('.') + 1) : 'bin'
    downloadBytesAsFile(it.bytes, it.filename, mimeForExt(ext))
    if (i < list.length - 1) {
      await new Promise((r) => setTimeout(r, 280))
    }
  }
  return { count: list.length }
}

/** ZIP aus bereits gelisteten Medien (Auswahl per id). */
export async function downloadMorgMediaZipFromItems(
  items: MorgMediaListItem[],
  ids?: string[] | null
): Promise<{ count: number }> {
  let list = items
  if (ids?.length) {
    const set = new Set(ids)
    list = items.filter((x) => set.has(x.id))
  }
  if (list.length === 0) return { count: 0 }
  const files: Record<string, Uint8Array> = {}
  for (const m of list) files[`medien/${m.filename}`] = m.bytes
  const zipped = zipSync(files, { level: 6 })
  const blob = new Blob([zipped], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `morgendrot-medien-${Date.now()}.zip`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return { count: list.length }
}

/** Einzeldateien nacheinander speichern (kein ZIP). */
export async function downloadMorgMediaFilesDirect(
  messages: Message[],
  opts?: { kinds?: MorgMediaKindFilter | null; ids?: string[] | null }
): Promise<{ count: number }> {
  const items = await listMorgMediaForExport(messages, opts)
  return downloadMorgMediaListItems(items, opts?.ids)
}

/** Nur Medien-Ordner als ZIP (optionaler Massen-Download). */
export async function downloadMorgMediaZipOnly(
  messages: Message[],
  opts?: { kinds?: MorgMediaKindFilter | null }
): Promise<{ count: number }> {
  const media = await extractMorgMediaFromMessages(messages, opts)
  if (media.length === 0) return { count: 0 }
  const files: Record<string, Uint8Array> = {}
  for (const m of media) files[m.path] = m.bytes
  const zipped = zipSync(files, { level: 6 })
  const blob = new Blob([zipped], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `morgendrot-medien-${Date.now()}.zip`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return { count: media.length }
}

export async function buildEinsatzprotokollZipBytes(
  messages: Message[],
  meta: { exportedByAddress?: string },
  opts?: { messageIds?: string[] | null; kinds?: MorgMediaKindFilter | null }
): Promise<Uint8Array> {
  const payload = buildEinsatzprotokollPayload(messages, meta, opts)
  const html = buildEinsatzprotokollHtml(payload)
  const jsonStr = JSON.stringify(payload, null, 2)
  const files: Record<string, Uint8Array> = {
    'protokoll.json': strToU8(jsonStr),
    'protokoll.html': strToU8(html),
  }
  const selected =
    opts?.messageIds?.length ? messages.filter((x) => opts.messageIds!.includes(x.id)) : messages
  for (const m of await extractMorgMediaFromMessages(selected, { kinds: opts?.kinds ?? null })) {
    files[m.path] = m.bytes
  }
  return zipSync(files, { level: 6 })
}

/** Direktes ZIP (protokoll.json, protokoll.html, medien/) — nur in vertrauenswürdiger Umgebung. */
export async function downloadEinsatzprotokollZipPlain(
  messages: Message[],
  meta: { exportedByAddress?: string },
  opts?: { messageIds?: string[] | null; kinds?: MorgMediaKindFilter | null }
): Promise<void> {
  const zipped = await buildEinsatzprotokollZipBytes(messages, meta, opts)
  const blob = new Blob([zipped], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `morgendrot-einsatzprotokoll-${Date.now()}.zip`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Ein Schritt: Passwort → verschlüsselte JSON-Datei (Inhalt nach Entschlüsselung = .zip). */
export async function downloadEinsatzprotokollZipPasswordProtected(
  messages: Message[],
  meta: { exportedByAddress?: string },
  password: string,
  opts?: { messageIds?: string[] | null; kinds?: MorgMediaKindFilter | null }
): Promise<void> {
  const zipped = await buildEinsatzprotokollZipBytes(messages, meta, opts)
  const enc = await encryptEinsatzprotokollZipBytes(zipped, password)
  downloadEinsatzprotokollEncryptedJson(enc)
}
