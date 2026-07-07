'use client'

/**
 * Einsatzprotokoll: Im Browser wird zuerst ein echtes ZIP (protokoll.json, protokoll.html, medien/) gebaut,
 * dann AES-GCM-verschlüsselt und als JSON-Datei (*.zip.enc.json) heruntergeladen – kein klassisches „ZIP mit Passwort“.
 * Entschlüsseln: /einsatzbericht-decrypt.html → Download der entpackbaren .zip.
 */

import { strToU8, zipSync } from 'fflate'
import type { Message } from '@/frontend/lib/types'
import { normalizeMessengerWireContent } from '@/frontend/lib/compact-image-wire'
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

type ExtractedMedia = { path: string; bytes: Uint8Array }

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function extForMorgTag(tag: string): string {
  if (tag === 'MORG_AUDIO_V1') return 'opus'
  if (tag === 'MORG_COMPACT_IMG_V1') return 'compact.bin'
  if (tag === 'MORG_LUMA_V1' || tag === 'MORG_CHROMA_V1') return 'jpg'
  if (tag === 'MORG_TXT_V1') return 'txt'
  if (tag === 'MORG_FILE_TXT_V1') return 'file.bin'
  if (tag.startsWith('MORG_SLIDE')) return 'slide.part'
  return 'bin'
}

export function extractMorgMediaFromMessages(messages: Message[]): ExtractedMedia[] {
  const out: ExtractedMedia[] = []
  const chronological = [...messages].sort((a, b) => a.timestamp - b.timestamp)
  let mediaIdx = 0
  for (let mi = 0; mi < chronological.length; mi++) {
    const m = chronological[mi]!
    const raw = normalizeMessengerWireContent(m.content ?? '')
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
      const ext = extForMorgTag(tag)
      try {
        if (tag === 'MORG_TXT_V1') {
          const txt = new TextDecoder().decode(b64ToBytes(payload))
          out.push({
            path: `medien/msg-${mi + 1}-txt-${mediaIdx++}.txt`,
            bytes: strToU8(txt),
          })
        } else {
          out.push({
            path: `medien/msg-${mi + 1}-${tag.replace(/^MORG_/, '').toLowerCase()}-${mediaIdx++}.${ext}`,
            bytes: b64ToBytes(payload),
          })
        }
      } catch {
        /* ungültig */
      }
    }
  }
  return out
}

export function buildEinsatzprotokollZipBytes(
  messages: Message[],
  meta: { exportedByAddress?: string },
  opts?: { messageIds?: string[] | null }
): Uint8Array {
  const payload = buildEinsatzprotokollPayload(messages, meta, opts)
  const html = buildEinsatzprotokollHtml(payload)
  const jsonStr = JSON.stringify(payload, null, 2)
  const files: Record<string, Uint8Array> = {
    'protokoll.json': strToU8(jsonStr),
    'protokoll.html': strToU8(html),
  }
  const selected =
    opts?.messageIds?.length ? messages.filter((x) => opts.messageIds!.includes(x.id)) : messages
  for (const m of extractMorgMediaFromMessages(selected)) {
    files[m.path] = m.bytes
  }
  return zipSync(files, { level: 6 })
}

/** Direktes ZIP (protokoll.json, protokoll.html, medien/) — nur in vertrauenswürdiger Umgebung. */
export function downloadEinsatzprotokollZipPlain(
  messages: Message[],
  meta: { exportedByAddress?: string },
  opts?: { messageIds?: string[] | null }
): void {
  const zipped = buildEinsatzprotokollZipBytes(messages, meta, opts)
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
  opts?: { messageIds?: string[] | null }
): Promise<void> {
  const zipped = buildEinsatzprotokollZipBytes(messages, meta, opts)
  const enc = await encryptEinsatzprotokollZipBytes(zipped, password)
  downloadEinsatzprotokollEncryptedJson(enc)
}
