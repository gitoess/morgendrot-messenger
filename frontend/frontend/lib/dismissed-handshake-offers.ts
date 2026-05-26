/** Lokal abgelehnte Handshake-Anfragen (bleiben on-chain bis Purge). */

const LS_KEY = 'morgendrot.dismissedHandshakeOffers.v1'

export type DismissedHandshakeRecord = {
  sender: string
  nonce: string
  dismissedAt: number
}

function readAll(): DismissedHandshakeRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return []
    const j = JSON.parse(raw) as unknown
    if (!Array.isArray(j)) return []
    const out: DismissedHandshakeRecord[] = []
    for (const row of j) {
      if (!row || typeof row !== 'object') continue
      const o = row as Record<string, unknown>
      const sender = typeof o.sender === 'string' ? o.sender.trim().toLowerCase() : ''
      const nonce = typeof o.nonce === 'string' ? o.nonce.trim() : ''
      const dismissedAt = typeof o.dismissedAt === 'number' ? o.dismissedAt : 0
      if (!/^0x[a-f0-9]{64}$/.test(sender) || !nonce) continue
      out.push({ sender, nonce, dismissedAt })
    }
    return out
  } catch {
    return []
  }
}

function writeAll(rows: DismissedHandshakeRecord[]): void {
  if (typeof window === 'undefined') return
  const trimmed = rows.slice(-200)
  window.localStorage.setItem(LS_KEY, JSON.stringify(trimmed))
}

export function handshakeOfferFingerprint(sender: string, nonce: string): string {
  return `${sender.trim().toLowerCase()}:${nonce.trim()}`
}

export function readDismissedHandshakeFingerprints(): Set<string> {
  return new Set(readAll().map((r) => handshakeOfferFingerprint(r.sender, r.nonce)))
}

export function dismissHandshakeOffer(sender: string, nonce: string): void {
  const senderNorm = sender.trim().toLowerCase()
  const nonceNorm = nonce.trim()
  if (!/^0x[a-f0-9]{64}$/.test(senderNorm) || !nonceNorm) return
  const fp = handshakeOfferFingerprint(senderNorm, nonceNorm)
  const rows = readAll().filter((r) => handshakeOfferFingerprint(r.sender, r.nonce) !== fp)
  rows.push({ sender: senderNorm, nonce: nonceNorm, dismissedAt: Date.now() })
  writeAll(rows)
}

export function clearDismissedHandshakeForSender(sender: string): void {
  const s = sender.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(s)) return
  writeAll(readAll().filter((r) => r.sender !== s))
}
