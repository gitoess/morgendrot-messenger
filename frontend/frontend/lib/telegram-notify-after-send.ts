import {
  telegramNotifyAudienceLabel,
  type TelegramNotifyAudience,
} from '@/frontend/lib/telegram-notify-pref'

const ADDR_64_LOWER = /^0x[a-f0-9]{64}$/

/**
 * Reine Entscheidung: nach IOTA-Online-Send optionalen Telegram-Hinweis planen.
 * (§ H.1b Mini — Logik aus `use-chat-view-handle-send`, Verhalten unverändert.)
 */
export type TelegramNotifyAfterSendPlan =
  | {
      kind: 'skip'
      reason: string
      audience: TelegramNotifyAudience
    }
  | {
      kind: 'call'
      audience: TelegramNotifyAudience
      /** API-Audience: self/both wenn Admin gewünscht, sonst contact (CC-only ok). */
      apiAudience: 'contact' | 'self' | 'both'
      recipientAddress?: string
      extraChatIds: string[]
      wantContact: boolean
      contactOk: boolean
    }

export function planTelegramNotifyAfterSend(opts: {
  audience: TelegramNotifyAudience
  recipientAddress: string
  contactTelegramChatId?: string | null
  extraChatIds: string[]
}): TelegramNotifyAfterSendPlan {
  const notifyAddr = opts.recipientAddress.trim().toLowerCase()
  const wantContact = opts.audience === 'contact' || opts.audience === 'both'
  const wantSelf = opts.audience === 'self' || opts.audience === 'both'
  const extraIds = opts.extraChatIds
  const contactOk =
    ADDR_64_LOWER.test(notifyAddr) && Boolean(opts.contactTelegramChatId?.trim())
  const canCallApi = (wantContact && contactOk) || wantSelf || extraIds.length > 0

  if (!canCallApi) {
    const reason = !ADDR_64_LOWER.test(notifyAddr)
      ? 'nur bei 1:1 mit 0x-Empfänger'
      : 'Kontakt ohne Telegram-ID im Telefonbuch'
    return { kind: 'skip', reason, audience: opts.audience }
  }

  return {
    kind: 'call',
    audience: opts.audience,
    apiAudience: wantSelf ? (wantContact ? 'both' : 'self') : 'contact',
    recipientAddress: contactOk ? notifyAddr : undefined,
    extraChatIds: extraIds,
    wantContact,
    contactOk,
  }
}

/** Statuszeile nach erfolgreicher Notify-API (delivered). */
export function formatTelegramNotifyDeliveredSuffix(opts: {
  audience: TelegramNotifyAudience
  wantContact: boolean
  contactOk: boolean
  deliveredContact?: boolean
  deliveredAdmin?: boolean
  deliveredExtra?: number
}): string {
  const parts: string[] = []
  if (opts.deliveredContact) parts.push('Kontakt')
  if (opts.deliveredAdmin) parts.push('dich')
  if (opts.deliveredExtra && opts.deliveredExtra > 0) {
    parts.push(`${opts.deliveredExtra}× CC`)
  }
  const note =
    opts.wantContact &&
    !opts.contactOk &&
    (opts.deliveredAdmin || (opts.deliveredExtra ?? 0) > 0)
      ? ' (Kontakt ohne TG-ID übersprungen)'
      : ''
  const who =
    parts.length > 0 ? parts.join(' + ') : telegramNotifyAudienceLabel(opts.audience)
  return `Telegram-Hinweis an ${who} gesendet.${note}`
}
