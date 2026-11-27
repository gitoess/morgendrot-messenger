/**
 * Visitenkarte aus Inbox-Klartext parsen → Kontaktfelder.
 * @see docs/IDEEN-BACKLOG.md (Übernehmen-CTA)
 */

import { parseContactQrPayload } from '@/frontend/lib/contact-qr'

export type VisitenkarteIngestFields = {
  address: string
  displayName?: string
  mailboxPrivateId?: string
  mailboxSharedId?: string
  mailboxTeamId?: string
  mailboxBufferId?: string
  telegramChatId?: string
  meshNodeId?: string
  ecdhPubB64?: string
}

/** Erkennt typische Visitenkarte (Header und/oder eingebettetes `mc`-JSON). */
export function looksLikeVisitenkarteMessage(content: string): boolean {
  const t = String(content ?? '')
  if (/Morgendrot\s+Visitenkarte/i.test(t)) return true
  return parseVisitenkarteMessage(t) != null
}

function pickLineValue(text: string, label: RegExp): string | undefined {
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(label)
    if (m?.[1]) return m[1].trim()
  }
  return undefined
}

/**
 * Parst Klartext-Visitenkarte: optionale Zeilen + `mc`-JSON irgendwo im Text.
 */
export function parseVisitenkarteMessage(content: string): VisitenkarteIngestFields | null {
  const text = String(content ?? '').trim()
  if (!text) return null

  let fromQr: ReturnType<typeof parseContactQrPayload> = null
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t.startsWith('{')) continue
    const p = parseContactQrPayload(t)
    if (p?.address) {
      fromQr = p
      break
    }
  }
  if (!fromQr) {
    const brace = text.indexOf('{')
    if (brace >= 0) {
      const slice = text.slice(brace)
      const end = slice.lastIndexOf('}')
      if (end > 0) fromQr = parseContactQrPayload(slice.slice(0, end + 1))
    }
  }

  const walletLine = pickLineValue(text, /^Wallet:\s*(0x[a-fA-F0-9]{64})\s*$/i)
  const address = (fromQr?.address || walletLine || '').trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(address)) return null

  const nameLine = pickLineValue(text, /^Name:\s*(.+)\s*$/i)
  const mailboxLine = pickLineValue(text, /^Mailbox:\s*(0x[a-fA-F0-9]{64})\s*$/i)
  const tgLine = pickLineValue(text, /^Telegram-Chat-ID:\s*(\S+)\s*$/i)
  const meshLine = pickLineValue(text, /^Funk-Node:\s*(\S+)\s*$/i)

  return {
    address,
    ...(fromQr?.displayName || nameLine
      ? { displayName: (fromQr?.displayName || nameLine || '').trim().slice(0, 64) }
      : {}),
    ...(fromQr?.mailboxPrivateId || mailboxLine
      ? { mailboxPrivateId: (fromQr?.mailboxPrivateId || mailboxLine || '').toLowerCase() }
      : {}),
    ...(fromQr?.mailboxSharedId ? { mailboxSharedId: fromQr.mailboxSharedId } : {}),
    ...(fromQr?.mailboxTeamId ? { mailboxTeamId: fromQr.mailboxTeamId } : {}),
    ...(fromQr?.mailboxBufferId ? { mailboxBufferId: fromQr.mailboxBufferId } : {}),
    ...(tgLine ? { telegramChatId: tgLine } : {}),
    ...(meshLine ? { meshNodeId: meshLine } : {}),
    ...(fromQr?.ecdhPubB64 ? { ecdhPubB64: fromQr.ecdhPubB64 } : {}),
  }
}
