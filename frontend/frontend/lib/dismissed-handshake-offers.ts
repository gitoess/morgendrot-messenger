/** Lokal abgelehnte Handshake-Anfragen (bleiben on-chain bis Purge). */

import { readScoped, writeScoped } from '@/frontend/lib/package-profile-namespace'

const LS_KEY = 'morgendrot.dismissedHandshakeOffers.v1'
const HANDSHAKE_DOMAIN = 'handshakes'

export type DismissedHandshakeRecord = {
  sender: string
  nonce: string
  dismissedAt: number
}

function readAll(): DismissedHandshakeRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = readScoped(HANDSHAKE_DOMAIN, LS_KEY)
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
  writeScoped(HANDSHAKE_DOMAIN, LS_KEY, JSON.stringify(trimmed))
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

/** Lokal ausgeblendete gesendete Handshake-Anfragen. */

const LS_OUTGOING_KEY = 'morgendrot.dismissedOutgoingHandshakeOffers.v1'

function readOutgoingAll(): DismissedHandshakeRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = readScoped(HANDSHAKE_DOMAIN, LS_OUTGOING_KEY)
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

function writeOutgoingAll(rows: DismissedHandshakeRecord[]): void {
  if (typeof window === 'undefined') return
  writeScoped(HANDSHAKE_DOMAIN, LS_OUTGOING_KEY, JSON.stringify(rows.slice(-200)))
}

/** `sender`-Feld = Empfänger-Adresse (recipient). */
export function outgoingHandshakeOfferFingerprint(recipient: string, nonce: string): string {
  return `${recipient.trim().toLowerCase()}:${nonce.trim()}`
}

export function readDismissedOutgoingHandshakeFingerprints(): Set<string> {
  return new Set(
    readOutgoingAll().map((r) => outgoingHandshakeOfferFingerprint(r.sender, r.nonce))
  )
}

export function dismissOutgoingHandshakeOffer(recipient: string, nonce: string): void {
  const recipientNorm = recipient.trim().toLowerCase()
  const nonceNorm = nonce.trim()
  if (!/^0x[a-f0-9]{64}$/.test(recipientNorm) || !nonceNorm) return
  const fp = outgoingHandshakeOfferFingerprint(recipientNorm, nonceNorm)
  const rows = readOutgoingAll().filter(
    (r) => outgoingHandshakeOfferFingerprint(r.sender, r.nonce) !== fp
  )
  rows.push({ sender: recipientNorm, nonce: nonceNorm, dismissedAt: Date.now() })
  writeOutgoingAll(rows)
}
