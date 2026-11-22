import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { isIotaWalletAddress } from '@/frontend/lib/contact-storage-key'
import {
  normalizeTelegramRecipientInput,
  parseTelegramRecipientChatIds,
} from '@/frontend/lib/telegram-notify-pref'

const IOTA_ADDR = /^0x[a-f0-9]{64}$/i

/** Kurzform aus UI („0x7988…adb3“) oder Ellipse — keine gültige Chain-Adresse. */
export function looksLikeTruncatedIotaAddress(raw: string): boolean {
  const t = raw.trim()
  if (!t) return false
  if (IOTA_ADDR.test(t)) return false
  if (/[…⋯]|\.\.\./.test(t) && /^0x/i.test(t)) return true
  const hex = t.replace(/^0x/i, '').replace(/[^a-f0-9]/gi, '')
  return /^0x/i.test(t) && hex.length > 0 && hex.length < 64
}

/** Composer-/Partner-Eingabe säubern (kein Erfinden fehlender Hex-Zeichen). */
export function sanitizeComposerAddressInput(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '')
}

/** Nutzerhinweis wenn Empfänger fehlt oder nur als Kurzform klebt. */
export function describeMissingComposerIotaRecipient(p: {
  recipient: string
  partner: string
  encrypted: boolean
  isPrivate?: boolean
}): string | null {
  const resolved = p.encrypted
    ? resolveComposerIotaAddress(p.recipient, p.partner, true)
    : resolveComposerKlartextIotaAddress(p.recipient, p.partner, p.isPrivate !== false)
  if (resolved && IOTA_ADDR.test(resolved)) return null
  const raw = `${p.recipient} ${p.partner}`.trim()
  if (looksLikeTruncatedIotaAddress(p.recipient) || looksLikeTruncatedIotaAddress(p.partner) || looksLikeTruncatedIotaAddress(raw)) {
    return 'Kurzadresse erkannt (z. B. 0x7988…adb3). Volle 0x + 64 Hex eintragen — im Header „Eigene Adresse“ aufklappen und „Kopieren“.'
  }
  if (p.encrypted) {
    return 'Verschlüsselt: volle 0x-Empfängeradresse im Partner-Feld (Handshake) oder Empfängerfeld — Telefonbuch optional.'
  }
  return 'Empfänger fehlt: volle Wallet-0x (64 Hex) im Empfängerfeld. Telefonbuch nicht nötig.'
}

function collectIotaAddressesFromField(raw: string, seen: Set<string>, out: string[]): void {
  for (const part of raw.split(/[,;\n]+/)) {
    const a = part.trim().toLowerCase()
    if (!IOTA_ADDR.test(a) || seen.has(a)) continue
    seen.add(a)
    out.push(a)
  }
}

/**
 * IOTA-Empfänger in der Komma-Liste ein-/ausklappen (mehrere, aber nicht „Alle“).
 * Normaler Kontakt-Klick bleibt 1:1 — diese Funktion nur für „+ Empfänger“.
 */
export function toggleComposerIotaRecipientAddress(
  recipientField: string,
  address: string
): { recipient: string; added: boolean; count: number } {
  const addr = sanitizeComposerAddressInput(address).toLowerCase()
  if (!IOTA_ADDR.test(addr)) {
    return { recipient: recipientField.trim(), added: false, count: 0 }
  }
  const seen = new Set<string>()
  const list: string[] = []
  collectIotaAddressesFromField(recipientField, seen, list)
  const had = seen.has(addr)
  if (had) {
    const next = list.filter((a) => a !== addr)
    return { recipient: next.join(', '), added: false, count: next.length }
  }
  list.push(addr)
  return { recipient: list.join(', '), added: true, count: list.length }
}

/** Alle 0x-Empfänger aus Composer (Komma-Liste bei „Alle“ / Broadcast). */
export function parseComposerIotaRecipientAddresses(
  recipient: string,
  partner: string,
  encrypted: boolean
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  collectIotaAddressesFromField(recipient, seen, out)
  if (partner.trim() && (encrypted || out.length === 0)) {
    collectIotaAddressesFromField(partner, seen, out)
  }
  return out
}

export function isComposerIotaBroadcast(
  recipient: string,
  partner: string,
  encrypted: boolean
): boolean {
  return parseComposerIotaRecipientAddresses(recipient, partner, encrypted).length > 1
}

/** Rohes IOTA-Feld im Composer (auch unfertige Eingabe). */
export function resolveComposerIotaFieldValue(
  recipient: string,
  partner: string,
  encrypted: boolean
): string {
  if (isComposerIotaBroadcast(recipient, partner, encrypted)) {
    return parseComposerIotaRecipientAddresses(recipient, partner, encrypted).join(', ')
  }
  const r = recipient.trim().toLowerCase()
  if (r.startsWith('tg:')) return encrypted ? partner.trim().toLowerCase() : ''
  if (r.startsWith('0x')) return r
  return encrypted ? partner.trim().toLowerCase() : r
}

/** IOTA-Wallet im Composer (Klartext: recipient, verschlüsselt: partner bevorzugt). */
export function resolveComposerIotaAddress(
  recipient: string,
  partner: string,
  encrypted: boolean
): string {
  const addrs = parseComposerIotaRecipientAddresses(recipient, partner, encrypted)
  if (addrs.length > 0) return addrs[0]!
  const r = recipient.trim().toLowerCase()
  if (isIotaWalletAddress(r)) return r
  if (encrypted) {
    const p = partner.trim().toLowerCase()
    if (isIotaWalletAddress(p)) return p
  }
  return ''
}

/** Ziel-0x für verschlüsselten Mailbox-/Online-Versand (Composer oder Partner-Setup). */
export function resolveEncryptedMailboxRecipient(recipient: string, partner: string): string {
  return resolveComposerIotaAddress(recipient, partner, true)
}

/** Klartext-Online: Composer-Empfänger; im privaten 1:1 zusätzlich Partner-Fallback (wie verschlüsselt). */
export function resolveComposerKlartextIotaAddress(
  recipient: string,
  partner: string,
  isPrivate: boolean
): string {
  const addrs = parseComposerIotaRecipientAddresses(recipient, partner, false)
  if (addrs.length > 0) return addrs[0]!
  const direct = resolveComposerIotaAddress(recipient, partner, false)
  if (direct) return direct
  if (isPrivate) return resolveComposerIotaAddress(recipient, partner, true)
  return ''
}

/** Telegram Chat-ID(s) aus recipient oder Telefonbuch. */
export function resolveComposerTelegramChatId(
  recipient: string,
  contactDirectory: Record<string, ContactMeshEntryClient> | undefined,
  iotaAddress: string
): string {
  const list = resolveComposerTelegramChatIds(recipient, contactDirectory, iotaAddress)
  return list[0] ?? ''
}

export function resolveComposerTelegramChatIds(
  recipient: string,
  contactDirectory: Record<string, ContactMeshEntryClient> | undefined,
  iotaAddress: string,
  opts?: { telegramDelivery?: boolean }
): string[] {
  const fromField = parseTelegramRecipientChatIds(recipient)
  if (fromField.length > 0) return fromField
  if (opts?.telegramDelivery) return []
  if (iotaAddress && contactDirectory?.[iotaAddress]?.telegramChatId?.trim()) {
    return [contactDirectory[iotaAddress].telegramChatId!.trim()]
  }
  return []
}
