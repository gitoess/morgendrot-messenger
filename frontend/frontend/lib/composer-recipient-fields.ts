import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { isIotaWalletAddress } from '@/frontend/lib/contact-storage-key'
import { normalizeTelegramRecipientInput } from '@/frontend/lib/telegram-notify-pref'

/** Rohes IOTA-Feld im Composer (auch unfertige Eingabe). */
export function resolveComposerIotaFieldValue(
  recipient: string,
  partner: string,
  encrypted: boolean
): string {
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
  const r = recipient.trim().toLowerCase()
  if (isIotaWalletAddress(r)) return r
  if (encrypted) {
    const p = partner.trim().toLowerCase()
    if (isIotaWalletAddress(p)) return p
  }
  return ''
}

/** Telegram Chat-ID (Ziffern) aus recipient tg:-Key oder Telefonbuch. */
export function resolveComposerTelegramChatId(
  recipient: string,
  contactDirectory: Record<string, ContactMeshEntryClient> | undefined,
  iotaAddress: string
): string {
  const norm = normalizeTelegramRecipientInput(recipient)
  if (norm.startsWith('tg:')) return norm.slice(3)
  if (iotaAddress && contactDirectory?.[iotaAddress]?.telegramChatId?.trim()) {
    return contactDirectory[iotaAddress].telegramChatId!.trim()
  }
  return ''
}
