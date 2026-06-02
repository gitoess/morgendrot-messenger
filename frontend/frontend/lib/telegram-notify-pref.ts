const LS_TELEGRAM_NOTIFY_ON_SEND = 'morgendrot.telegramNotifyOnSend'

/** Composer: nach erfolgreichem Online-Send optional Telegram-Hinweis an Kontakt (§ H.26 B). */
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
}): string {
  const t = opts.message.trim()
  if (t) return t
  if (opts.attachedTxtFile) {
    return opts.attachedTxtFile.text.slice(0, 200) || `[${opts.attachedTxtFile.name}]`
  }
  if (opts.attachedBlobBase64) return '[Bild-Anhang]'
  if (opts.attachedAudioBase64) return '[Audio-Anhang]'
  if (opts.hasLoraAttachment) return '[LoRa-Bild]'
  return 'Neue Morgendrot-Nachricht'
}
