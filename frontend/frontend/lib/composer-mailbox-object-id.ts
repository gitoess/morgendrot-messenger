/** Pro Empfänger-Wallet: optionale Mailbox-Object-ID im Composer (leer = Event). */

const LS_KEY = 'morgendrot.composerMailboxObjectIdByWallet.v1'
const ADDR_64 = /^0x[a-f0-9]{64}$/

function readMap(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== 'object' || Array.isArray(j)) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
      const wallet = k.trim().toLowerCase()
      const mb = String(v ?? '').trim().toLowerCase()
      if (ADDR_64.test(wallet) && ADDR_64.test(mb)) out[wallet] = mb
    }
    return out
  } catch {
    return {}
  }
}

export function normalizeMailboxObjectIdInput(raw: string): string {
  const t = raw.trim().toLowerCase()
  return ADDR_64.test(t) ? t : ''
}

export function readComposerMailboxObjectId(recipientWallet0x: string): string {
  const wallet = recipientWallet0x.trim().toLowerCase()
  if (!ADDR_64.test(wallet)) return ''
  return readMap()[wallet] ?? ''
}

export function writeComposerMailboxObjectId(recipientWallet0x: string, mailboxObjectId: string): void {
  if (typeof window === 'undefined') return
  const wallet = recipientWallet0x.trim().toLowerCase()
  if (!ADDR_64.test(wallet)) return
  const map = readMap()
  const mb = normalizeMailboxObjectIdInput(mailboxObjectId)
  if (mb) map[wallet] = mb
  else delete map[wallet]
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}
