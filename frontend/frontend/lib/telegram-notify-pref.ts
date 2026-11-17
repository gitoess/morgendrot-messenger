const LS_TELEGRAM_NOTIFY_ON_SEND = 'morgendrot.telegramNotifyOnSend'
const LS_TELEGRAM_NOTIFY_AUDIENCE = 'morgendrot.telegramNotifyAudience'
/** Zusätzliche Telegram-Chat-IDs (CC) nach IOTA-Send — max. siehe Cap. */
const LS_TELEGRAM_NOTIFY_EXTRA_IDS = 'morgendrot.telegramNotifyExtraChatIds'
export const TELEGRAM_NOTIFY_EXTRA_IDS_CAP = 5

/**
 * Wer den optionalen Telegram-Hinweis nach IOTA-Online-Send bekommt.
 * Alarmgruppe bewusst nicht — die bleibt SOS / „Team alarmieren“ (B4b).
 */
export type TelegramNotifyAudience = 'contact' | 'self' | 'both'

export function isTelegramNotifyAudience(v: unknown): v is TelegramNotifyAudience {
  return v === 'contact' || v === 'self' || v === 'both'
}

/** Composer: nach erfolgreichem Online-Send optional Telegram-Hinweis (§ H.26 B). */
export function readTelegramNotifyOnSend(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(LS_TELEGRAM_NOTIFY_ON_SEND) === '1'
  } catch {
    return false
  }
}

export function writeTelegramNotifyOnSend(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_TELEGRAM_NOTIFY_ON_SEND, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** Default: nur Kontakt (bisheriges Verhalten). */
export function readTelegramNotifyAudience(): TelegramNotifyAudience {
  if (typeof window === 'undefined') return 'contact'
  try {
    const raw = window.localStorage.getItem(LS_TELEGRAM_NOTIFY_AUDIENCE)
    return isTelegramNotifyAudience(raw) ? raw : 'contact'
  } catch {
    return 'contact'
  }
}

export function writeTelegramNotifyAudience(audience: TelegramNotifyAudience): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_TELEGRAM_NOTIFY_AUDIENCE, audience)
  } catch {
    /* ignore */
  }
}

export function telegramNotifyAudienceLabel(audience: TelegramNotifyAudience): string {
  switch (audience) {
    case 'self':
      return 'nur dich (Admin-Chat-ID)'
    case 'both':
      return 'Kontakt und dich'
    default:
      return 'nur den Kontakt'
  }
}

/** Optionale weitere Chat-IDs (CC) — getrennt von Audience und Alarmgruppe. */
export function readTelegramNotifyExtraChatIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LS_TELEGRAM_NOTIFY_EXTRA_IDS) || ''
    return parseTelegramRecipientChatIds(raw).slice(0, TELEGRAM_NOTIFY_EXTRA_IDS_CAP)
  } catch {
    return []
  }
}

export function writeTelegramNotifyExtraChatIds(raw: string): string[] {
  const ids = parseTelegramRecipientChatIds(raw).slice(0, TELEGRAM_NOTIFY_EXTRA_IDS_CAP)
  if (typeof window === 'undefined') return ids
  try {
    window.localStorage.setItem(LS_TELEGRAM_NOTIFY_EXTRA_IDS, ids.join(','))
  } catch {
    /* ignore */
  }
  return ids
}

export function formatTelegramNotifyExtraChatIdsDisplay(ids: string[]): string {
  return ids.join(', ')
}

const ADDR_64 = /^0x[a-f0-9]{64}$/
const TG_KEY = /^tg:-?\d{1,20}$/

/** `tg:…` oder reine Chat-ID-Ziffern → Verzeichnis-Schlüssel. */
export function normalizeTelegramRecipientInput(raw: string): string {
  const t = raw.trim()
  const lower = t.toLowerCase()
  if (TG_KEY.test(lower)) return lower
  if (/^-?\d{1,20}$/.test(t)) return `tg:${t}`
  return lower
}

/** Mehrere Telegram-Empfänger: komma-/semikolongetrennt oder mehrere tg:-Keys. */
export function parseTelegramRecipientChatIds(raw: string): string[] {
  const parts = String(raw || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const ids = new Set<string>()
  for (const p of parts) {
    const norm = normalizeTelegramRecipientInput(p)
    if (TG_KEY.test(norm)) ids.add(norm.slice(3))
    else if (/^-?\d{1,20}$/.test(p)) ids.add(p)
  }
  return [...ids]
}

/** Anzeige im Composer (ohne tg:-Präfix). */
export function formatTelegramRecipientListDisplay(raw: string): string {
  return parseTelegramRecipientChatIds(raw).join(', ')
}

/** Rohes recipient-Feld → Anzeige im Composer (Ziffern, Kommas; ohne 0x-Wallet). */
export function telegramRecipientToComposerDisplay(raw: string): string {
  const t = String(raw || '').trim()
  if (!t || /^0x[a-f0-9]{64}$/i.test(t)) return ''
  if (t.includes('tg:') || /[,;\n]/.test(t) || /^-?\d{1,20}$/.test(t)) {
    return formatTelegramRecipientListDisplay(t)
  }
  return t
}

/** Speichern im recipient-Feld als tg:123,tg:456 (optional, z. B. Export). */
export function encodeTelegramRecipientList(raw: string): string {
  return parseTelegramRecipientChatIds(raw)
    .map((id) => `tg:${id}`)
    .join(',')
}

/** Ziel-Adresse für Telegram-Hinweis (Klartext-Empfänger oder Handshake-Partner). */
export function resolveTelegramNotifyRecipientAddress(opts: {
  recipient: string
  partner?: string
  encrypted: boolean
  connectedAddresses?: string[]
}): string | null {
  const r = normalizeTelegramRecipientInput(opts.recipient)
  if (ADDR_64.test(r)) return r
  if (TG_KEY.test(r)) return r
  if (opts.encrypted) {
    const p = normalizeTelegramRecipientInput(opts.partner || '')
    if (ADDR_64.test(p)) return p
    if (TG_KEY.test(p)) return p
    const conn = (opts.connectedAddresses || []).map((a) => a.toLowerCase())
    if (conn.length === 1 && ADDR_64.test(conn[0]!)) return conn[0]!
  }
  return null
}

export function buildTelegramMessagePreview(opts: {
  message: string
  attachedTxtFile?: { name: string; text: string } | null
  attachedBlobBase64?: string | null
  attachedAudioBase64?: string | null
  hasLoraAttachment?: boolean
  /** z. B. erster Wire-Snap wenn Composer leer (Send-Flow). */
  fallbackText?: string | null
}): string {
  const t = opts.message.trim()
  if (t) return t
  if (opts.attachedTxtFile) {
    return opts.attachedTxtFile.text.slice(0, 200) || `[${opts.attachedTxtFile.name}]`
  }
  if (opts.attachedBlobBase64) return '[Bild-Anhang]'
  if (opts.attachedAudioBase64) return '[Audio-Anhang]'
  if (opts.hasLoraAttachment) return '[LoRa-Bild]'
  const fb = opts.fallbackText?.trim()
  if (fb) return fb.slice(0, 200)
  return 'Neue Morgendrot-Nachricht'
}
