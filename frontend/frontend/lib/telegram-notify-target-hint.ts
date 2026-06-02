import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { resolveTelegramNotifyRecipientAddress } from '@/frontend/lib/telegram-notify-pref'

/** Anzeige unter „Nach Online-Send: Telegram-Hinweis“ — welcher Kontakt gemeint ist. */
export function formatTelegramNotifyTargetHint(p: {
  recipient: string
  partner: string
  encrypted: boolean
  contactDirectory: Record<string, ContactMeshEntryClient>
  connectedAddresses?: string[]
}): string {
  const addr = resolveTelegramNotifyRecipientAddress({
    recipient: p.recipient,
    partner: p.partner,
    encrypted: p.encrypted,
    connectedAddresses: p.connectedAddresses,
  })
  if (!addr) {
    return 'Kein Ziel: gültige 0x im Composer und Telegram-Chat-ID im Telefonbuch (oder Empfänger tg:…).'
  }
  if (addr.startsWith('tg:')) {
    return `Ziel: Telegram Chat-ID ${addr.slice(3)}`
  }
  const label = contactDisplayLabel(p.contactDirectory, addr) || `${addr.slice(0, 10)}…`
  const tg = p.contactDirectory[addr]?.telegramChatId?.trim()
  if (tg) return `Ziel: ${label} · Telegram ${tg}`
  return `Ziel: ${label} — im Telefonbuch fehlt die Telegram-Chat-ID (Hinweis wird nicht gesendet).`
}
