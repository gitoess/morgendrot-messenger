/** Schlüssel für `.morgendrot-contact-labels.json` (0x… oder tg:<chatId>). */

const HEX_64 = /^0x[a-f0-9]{64}$/
const TG_KEY = /^tg:-?\d{1,20}$/

/** Platzhalter aus Tests/Events — kein echtes Gegenüber. */
export const ZERO_IOTA_ADDRESS = `0x${'0'.repeat(64)}` as const

export function isPlaceholderIotaAddress(key: string): boolean {
  return key.trim().toLowerCase() === ZERO_IOTA_ADDRESS
}

/** Telefonbuch-/Sidebar-Schlüssel (keine Platzhalter). */
export function isDisplayableContactStorageKey(key: string): boolean {
  const k = key.trim().toLowerCase()
  if (!k || isPlaceholderIotaAddress(k)) return false
  return isIotaWalletAddress(k) || isTelegramDirectoryKey(k)
}

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

export function isTelegramDirectoryKey(key: string): boolean {
  return TG_KEY.test(key.trim().toLowerCase())
}

/** Wallet-Feld im Telefonbuch: tg:-Schlüssel gehört nur ins Telegram-Feld. */
export function contactFormWalletFromStorageKey(storageKey: string): string {
  const k = storageKey.trim().toLowerCase()
  return isIotaWalletAddress(k) ? k : ''
}

export function formatContactDirectoryKey(key: string): string {
  const k = key.trim().toLowerCase()
  if (k.startsWith('tg:')) return `Telegram ${k.slice(3)}`
  if (k.length < 20) return k || '—'
  return `${k.slice(0, 10)}…${k.slice(-6)}`
}
