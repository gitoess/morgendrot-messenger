'use client'

/**
 * Lesbarer Einsatzbericht (ohne Morgendrot-Gerät nutzbar bei Klartext-JSON;
 * verschlüsselte Variante: siehe einsatzbericht-crypto + /einsatzbericht-decrypt.html).
 */

import type { Message } from '@/frontend/lib/types'

export type EinsatzberichtExportMeta = {
  exportedAt: number
  exportedByAddress?: string
  note: string
}

export function buildEinsatzberichtPayload(
  messages: Message[],
  meta: { exportedByAddress?: string }
): {
  schema: string
  meta: EinsatzberichtExportMeta
  messagesChronological: Array<{
    id: string
    from: string
    timestamp: number
    iso: string
    recipient?: string
    encrypted: boolean
    transports: string[]
    content: string
    contentLength: number
  }>
} {
  const chronological = [...messages].sort((a, b) => a.timestamp - b.timestamp)
  return {
    schema: 'morgendrot.einsatzbericht.v1',
    meta: {
      exportedAt: Date.now(),
      exportedByAddress: meta.exportedByAddress,
      note: 'Chronologische Kopie des lokalen Posteingangs (Wire-Inhalte wie in der UI). Für Dritte: Klartext-Export kann sensible Daten enthalten; verschlüsselter Export bevorzugen.',
    },
    messagesChronological: chronological.map((m) => ({
      id: m.id,
      from: m.from,
      timestamp: m.timestamp,
      iso: new Date(m.timestamp).toISOString(),
      recipient: m.recipient,
      encrypted: m.encrypted === true,
      transports: m.transports?.length ? [...m.transports] : m.source === 'mesh' ? ['mesh'] : ['internet'],
      content: m.content ?? '',
      contentLength: (m.content ?? '').length,
    })),
  }
}

/** Vollständiger Klartext (alle Nachrichten, ungekürzt). */
export function buildEinsatzberichtFullText(payload: ReturnType<typeof buildEinsatzberichtPayload>): string {
  const lines: string[] = [
    `Morgendrot Nachrichtenverlauf (vollständig)`,
    `Export: ${new Date(payload.meta.exportedAt).toLocaleString('de-DE')}`,
    `Nachrichten: ${payload.messagesChronological.length}`,
    '',
  ]
  for (const m of payload.messagesChronological) {
    lines.push(`--- ${m.iso} | ${m.from} | ${m.transports.join(',')} | id=${m.id}`)
    lines.push(m.content || '(leer)')
    lines.push('')
  }
  return lines.join('\n')
}

export function buildEinsatzberichtSummaryText(payload: ReturnType<typeof buildEinsatzberichtPayload>): string {
  const lines: string[] = [
    `Morgendrot Nachrichtenverlauf (Text-Lesefassung)`,
    `Export: ${new Date(payload.meta.exportedAt).toLocaleString('de-DE')}`,
    `Nachrichten: ${payload.messagesChronological.length}`,
    '',
  ]
  for (const m of payload.messagesChronological) {
    const prev = m.content.length > 200 ? `${m.content.slice(0, 200)}…` : m.content
    lines.push(`--- ${m.iso} | ${m.from.slice(0, 12)}… | ${m.transports.join(',')}`)
    lines.push(prev.replace(/\s+/g, ' ').trim() || '(leer)')
    lines.push('')
  }
  return lines.join('\n')
}

export function downloadEinsatzberichtJson(messages: Message[], meta: { exportedByAddress?: string }): void {
  const payload = buildEinsatzberichtPayload(messages, meta)
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `morgendrot-einsatzbericht-${payload.meta.exportedAt}.json`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadEinsatzberichtFullTxt(messages: Message[], meta: { exportedByAddress?: string }): void {
  const payload = buildEinsatzberichtPayload(messages, meta)
  const txt = buildEinsatzberichtFullText(payload)
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `morgendrot-nachrichtenverlauf-voll-${payload.meta.exportedAt}.txt`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadEinsatzberichtSummaryTxt(messages: Message[], meta: { exportedByAddress?: string }): void {
  const payload = buildEinsatzberichtPayload(messages, meta)
  const txt = buildEinsatzberichtSummaryText(payload)
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `morgendrot-nachrichtenverlauf-kurz-${payload.meta.exportedAt}.txt`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
