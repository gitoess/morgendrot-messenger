'use client'

/**
 * Lesbarer Einsatzbericht (ohne Morgendrot-Gerät nutzbar bei Klartext-JSON;
 * verschlüsselte Variante: siehe einsatzbericht-crypto + /einsatzbericht-decrypt.html).
 */

import type { Message } from '@/frontend/lib/types'
import {
  decryptPassphraseMessageWire,
  isPassphraseMessageWire,
} from '@/frontend/lib/passphrase-message-crypto'
import {
  fingerprintPassphraseMessageWire,
  getDefaultPassphraseMessagePassphrase,
  lookupPassphraseMessagePassphrase,
} from '@/frontend/lib/passphrase-message-local-store'
import {
  findNftKeycardBindingForWireFingerprint,
  lookupPassphraseForNftKeycard,
} from '@/frontend/lib/nft-keycard-local-store'

export type EinsatzberichtExportMeta = {
  exportedAt: number
  exportedByAddress?: string
  note: string
}

export type EinsatzberichtContentMode = 'asStored' | 'plaintextOnly' | 'redactEncrypted'

function isEncryptedPlaceholderContent(s: string): boolean {
  return s.trimStart().startsWith('[Verschlüsselt]')
}

function looksLikeEncryptedWire(s: string): boolean {
  const t = s.trim()
  return (
    t.startsWith('MORG_PWMSG_V1:') ||
    t.startsWith('MORG_NFTGATE_V1:') ||
    t.startsWith('[[MORG_ENV') ||
    isEncryptedPlaceholderContent(t)
  )
}

/**
 * Passphrase-Wires mit lokal gemerkter Passphrase entsperren (wie im Chat nach Freischalten).
 * NFT-Gate / ECDH-Session bleiben Wire, solange kein Klartext in der Inbox liegt.
 */
function resolvePassphraseForExportWire(wire: string): string | null {
  const remembered = lookupPassphraseMessagePassphrase(wire)?.trim() || ''
  if (remembered.length >= 8) return remembered
  const fp = fingerprintPassphraseMessageWire(wire)
  const binding = findNftKeycardBindingForWireFingerprint(fp)
  const fromCard = binding
    ? lookupPassphraseForNftKeycard({
        objectId: binding.cardObjectId,
        wireFingerprint: fp,
        slotId: binding.slotId,
      })?.trim() || ''
    : lookupPassphraseForNftKeycard({ wireFingerprint: fp })?.trim() || ''
  if (fromCard.length >= 8) return fromCard
  const defPw = getDefaultPassphraseMessagePassphrase()?.trim() || ''
  return defPw.length >= 8 ? defPw : null
}

export async function unlockRememberedPassphraseMessagesForExport(
  messages: Message[]
): Promise<{ messages: Message[]; unlocked: number; stillSealed: number }> {
  const out: Message[] = []
  let unlocked = 0
  let stillSealed = 0
  for (const m of messages) {
    const raw = m.content ?? ''
    if (!isPassphraseMessageWire(raw)) {
      if (looksLikeEncryptedWire(raw)) stillSealed += 1
      out.push(m)
      continue
    }
    const pw = resolvePassphraseForExportWire(raw)
    if (!pw) {
      stillSealed += 1
      out.push(m)
      continue
    }
    try {
      const plain = await decryptPassphraseMessageWire(raw, pw)
      unlocked += 1
      out.push({ ...m, content: plain, encrypted: false })
    } catch {
      stillSealed += 1
      out.push(m)
    }
  }
  return { messages: out, unlocked, stillSealed }
}

function contentForExportMode(content: string, _encrypted: boolean, mode: EinsatzberichtContentMode): string | null {
  const c = content ?? ''
  if (mode === 'asStored') return c
  /** Nur am Inhalt erkennen — Flag `encrypted` bleibt nach Entschlüsselung oft true. */
  const sealed = looksLikeEncryptedWire(c)
  if (mode === 'plaintextOnly') {
    if (sealed) return null
    return c
  }
  /** redactEncrypted */
  if (sealed) return '[Verschlüsselt — nicht exportiert]'
  return c
}

export function buildEinsatzberichtPayload(
  messages: Message[],
  meta: { exportedByAddress?: string },
  opts?: { contentMode?: EinsatzberichtContentMode }
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
    source?: string
    transports: string[]
    content: string
    contentLength: number
    telegramMeta?: Message['telegramMeta']
    telegramRecipients?: string[]
    chainTxDigest?: string
  }>
} {
  const mode = opts?.contentMode ?? 'asStored'
  const chronological = [...messages].sort((a, b) => a.timestamp - b.timestamp)
  const rows = chronological
    .map((m) => {
      const raw = m.content ?? ''
      const content = contentForExportMode(raw, m.encrypted === true, mode)
      if (content === null) return null
      return {
        id: m.id,
        from: m.from,
        timestamp: m.timestamp,
        iso: new Date(m.timestamp).toISOString(),
        recipient: m.recipient,
        encrypted: m.encrypted === true,
        source: m.source,
        transports: m.transports?.length
          ? [...m.transports]
          : m.source === 'mesh'
            ? ['mesh']
            : m.source === 'telegram'
              ? ['telegram']
              : ['internet'],
        content,
        contentLength: content.length,
        ...(m.telegramMeta ? { telegramMeta: { ...m.telegramMeta } } : {}),
        ...(m.telegramRecipients?.length ? { telegramRecipients: [...m.telegramRecipients] } : {}),
        ...(m.chainTxDigest ? { chainTxDigest: m.chainTxDigest } : {}),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r != null)
  return {
    schema: 'morgendrot.einsatzbericht.v1',
    meta: {
      exportedAt: Date.now(),
      exportedByAddress: meta.exportedByAddress,
      note:
        mode === 'plaintextOnly'
          ? 'Nur Klartext (inkl. Passphrase-Wires mit gemerkter Passphrase). Versiegelte Reste ausgelassen.'
          : mode === 'redactEncrypted'
            ? 'Verschlüsselte Inhalte als Platzhalter (kein Unlock). Klartext nur wenn schon unverschlüsselt in der Inbox.'
            : 'Klartext wenn entsperrt/gemerkt; sonst Wire/Platzhalter. Telegram = Journal ohne Server-Medien.',
    },
    messagesChronological: rows,
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

export function buildEinsatzberichtJsonFile(
  messages: Message[],
  meta: { exportedByAddress?: string },
  opts?: { contentMode?: EinsatzberichtContentMode }
): { blob: Blob; filename: string; mime: string; count: number } {
  const payload = buildEinsatzberichtPayload(messages, meta, opts)
  const json = JSON.stringify(payload, null, 2)
  return {
    blob: new Blob([json], { type: 'application/json;charset=utf-8' }),
    filename: `morgendrot-einsatzbericht-${payload.meta.exportedAt}.json`,
    mime: 'application/json',
    count: payload.messagesChronological.length,
  }
}

export function buildEinsatzberichtFullTxtFile(
  messages: Message[],
  meta: { exportedByAddress?: string },
  opts?: { contentMode?: EinsatzberichtContentMode }
): { blob: Blob; filename: string; mime: string; count: number } {
  const payload = buildEinsatzberichtPayload(messages, meta, opts)
  const txt = buildEinsatzberichtFullText(payload)
  return {
    blob: new Blob([txt], { type: 'text/plain;charset=utf-8' }),
    filename: `morgendrot-nachrichtenverlauf-voll-${payload.meta.exportedAt}.txt`,
    mime: 'text/plain',
    count: payload.messagesChronological.length,
  }
}

export function buildEinsatzberichtSummaryTxtFile(
  messages: Message[],
  meta: { exportedByAddress?: string },
  opts?: { contentMode?: EinsatzberichtContentMode }
): { blob: Blob; filename: string; mime: string; count: number } {
  const payload = buildEinsatzberichtPayload(messages, meta, opts)
  const txt = buildEinsatzberichtSummaryText(payload)
  return {
    blob: new Blob([txt], { type: 'text/plain;charset=utf-8' }),
    filename: `morgendrot-nachrichtenverlauf-kurz-${payload.meta.exportedAt}.txt`,
    mime: 'text/plain',
    count: payload.messagesChronological.length,
  }
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}

export function downloadEinsatzberichtJson(
  messages: Message[],
  meta: { exportedByAddress?: string },
  opts?: { contentMode?: EinsatzberichtContentMode }
): void {
  const file = buildEinsatzberichtJsonFile(messages, meta, opts)
  triggerBlobDownload(file.blob, file.filename)
}

export function downloadEinsatzberichtFullTxt(
  messages: Message[],
  meta: { exportedByAddress?: string },
  opts?: { contentMode?: EinsatzberichtContentMode }
): void {
  const file = buildEinsatzberichtFullTxtFile(messages, meta, opts)
  triggerBlobDownload(file.blob, file.filename)
}

export function downloadEinsatzberichtSummaryTxt(
  messages: Message[],
  meta: { exportedByAddress?: string },
  opts?: { contentMode?: EinsatzberichtContentMode }
): void {
  const file = buildEinsatzberichtSummaryTxtFile(messages, meta, opts)
  triggerBlobDownload(file.blob, file.filename)
}
