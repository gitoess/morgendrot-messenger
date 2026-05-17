/** Schlüssel für `.morgendrot-contact-labels.json` (0x… oder tg:<chatId>). */

const HEX_64 = /^0x[a-f0-9]{64}$/
const TG_KEY = /^tg:-?\d{1,20}$/

export function normalizeTelegramChatId(raw: string): string | null {
  const t = raw.trim()
  return /^-?\d{1,20}$/.test(t) ? t : null
}

export function resolveContactStorageKey(addressRaw: string, telegramChatIdRaw?: string): string | null {
  const addr = addressRaw.trim().toLowerCase()
  if (HEX_64.test(addr)) return addr
  if (TG_KEY.test(addr)) return addr
  const tg = normalizeTelegramChatId(telegramChatIdRaw ?? '')
  return tg ? `tg:${tg}` : null
}

export function isIotaWalletAddress(key: string): boolean {
  return HEX_64.test(key.trim().toLowerCase())
}

export function formatContactDirectoryKey(key: string): string {
  const k = key.trim().toLowerCase()
  if (k.startsWith('tg:')) return `Telegram ${k.slice(3)}`
  if (k.length < 20) return k || '—'
  return `${k.slice(0, 10)}…${k.slice(-6)}`
}
