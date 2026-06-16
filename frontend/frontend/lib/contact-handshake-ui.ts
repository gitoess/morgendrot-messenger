import type { OutgoingHandshakeOffer, PendingHandshakeOffer } from '@/frontend/lib/api/package-connect'
import {
  isValidRecipient0x,
  resolveEncryptedRecipientHandshakeStatusSync,
  type EncryptedRecipientHandshakeStatus,
} from '@/frontend/lib/encrypted-recipient-handshake-status'

export type ContactHandshakeBadgeKind = 'none' | 'ready' | 'pending' | 'needs_action'

export function contactHandshakeBadgeKind(
  status: EncryptedRecipientHandshakeStatus
): ContactHandshakeBadgeKind {
  if (status === 'ready') return 'ready'
  if (status === 'awaiting_peer') return 'pending'
  if (status === 'checking') return 'pending'
  if (status === 'needs_handshake' || status === 'needs_accept') return 'needs_action'
  return 'none'
}

export function contactHandshakeBadgeLabel(kind: ContactHandshakeBadgeKind): string | null {
  switch (kind) {
    case 'ready':
      return 'Handshake'
    case 'pending':
      return 'Handshake ausstehend'
    case 'needs_action':
      return 'Handshake nötig'
    default:
      return null
  }
}

export function resolveContactHandshakeStatus(p: {
  address: string
  connectedAddresses: readonly string[]
  incomingOffers?: readonly PendingHandshakeOffer[]
  outgoingOffers?: readonly OutgoingHandshakeOffer[]
}): EncryptedRecipientHandshakeStatus {
  const addr = p.address.trim().toLowerCase()
  if (!isValidRecipient0x(addr)) return 'idle'
  return resolveEncryptedRecipientHandshakeStatusSync({
    recipient: addr,
    connectedAddresses: [...p.connectedAddresses],
    incomingOffers: [...(p.incomingOffers ?? [])],
    outgoingOffers: [...(p.outgoingOffers ?? [])],
  })
}

export function isContactHandshakeReady(status: EncryptedRecipientHandshakeStatus): boolean {
  return status === 'ready'
}
