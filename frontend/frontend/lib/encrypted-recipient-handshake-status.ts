import type { OutgoingHandshakeOffer, PendingHandshakeOffer } from '@/frontend/lib/api/package-connect'
import { canTryLiveEncryptedDirectMailbox } from '@/frontend/lib/direct-iota-encrypted-submit'
import {
  getDirectChatEcdhMaterialForRecipient,
  hasDirectChatEcdhPeerPubForRecipient,
} from '@/frontend/lib/direct-chat-ecdh-session'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'

const ADDR_64 = /^0x[a-f0-9]{64}$/

export type EncryptedRecipientHandshakeStatus =
  | 'idle'
  | 'checking'
  | 'ready'
  | 'needs_handshake'
  | 'awaiting_peer'
  | 'needs_accept'

export function normalizeRecipient0x(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isValidRecipient0x(raw: string): boolean {
  return ADDR_64.test(normalizeRecipient0x(raw))
}

/** Schnell aus Session + Handshake-Angeboten (ohne Chain-Lookup). */
export function resolveEncryptedRecipientHandshakeStatusSync(p: {
  recipient: string
  connectedAddresses: string[]
  incomingOffers: PendingHandshakeOffer[]
  outgoingOffers: OutgoingHandshakeOffer[]
}): EncryptedRecipientHandshakeStatus {
  const addr = normalizeRecipient0x(p.recipient)
  if (!ADDR_64.test(addr)) return 'idle'

  const connected = p.connectedAddresses.map((a) => a.trim().toLowerCase()).filter(Boolean)
  if (connected.includes(addr)) return 'ready'
  if (getDirectChatEcdhMaterialForRecipient(addr)) return 'ready'
  if (canTryLiveEncryptedDirectMailbox(addr)) return 'ready'

  const myAddr = normalizeRecipient0x(getDirectIotaSessionSignerAddress() ?? '')
  if (myAddr && addr === myAddr && hasDirectChatEcdhPeerPubForRecipient(addr)) {
    return 'ready'
  }

  if (p.incomingOffers.some((o) => normalizeRecipient0x(o.sender) === addr)) return 'needs_accept'

  if (p.outgoingOffers.some((o) => normalizeRecipient0x(o.recipient) === addr)) {
    if (hasDirectChatEcdhPeerPubForRecipient(addr) && !getDirectChatEcdhMaterialForRecipient(addr)) {
      return 'needs_accept'
    }
    return 'awaiting_peer'
  }

  return 'needs_handshake'
}

export function encryptedHandshakeBlocksSend(status: EncryptedRecipientHandshakeStatus): boolean {
  return status !== 'idle' && status !== 'checking' && status !== 'ready'
}

export function encryptedHandshakeStatusLabel(status: EncryptedRecipientHandshakeStatus): string {
  switch (status) {
    case 'ready':
      return 'Handshake aktiv — verschlüsselt senden möglich.'
    case 'needs_handshake':
      return 'Noch kein Schlüsselaustausch mit dieser Adresse — zuerst Handshake senden.'
    case 'awaiting_peer':
      return 'Handshake von dir gesendet — der Partner muss noch antworten (öffentlicher Schlüssel). Danach verschlüsselt senden.'
    case 'needs_accept':
      return 'Partner hat Handshake gesendet — zuerst annehmen (Connect), dann senden.'
    case 'checking':
      return 'Prüfe Handshake auf der Chain…'
    default:
      return ''
  }
}
