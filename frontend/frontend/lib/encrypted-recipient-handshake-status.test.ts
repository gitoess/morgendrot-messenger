import { describe, expect, it } from 'vitest'
import {
  encryptedHandshakeBlocksSend,
  resolveEncryptedRecipientHandshakeStatusSync,
} from '@/frontend/lib/encrypted-recipient-handshake-status'

const A = '0x' + 'a'.repeat(64)
const B = '0x' + 'b'.repeat(64)

describe('resolveEncryptedRecipientHandshakeStatusSync', () => {
  it('idle ohne Adresse', () => {
    expect(
      resolveEncryptedRecipientHandshakeStatusSync({
        recipient: '',
        connectedAddresses: [],
        incomingOffers: [],
        outgoingOffers: [],
      })
    ).toBe('idle')
  })

  it('ready wenn verbunden', () => {
    expect(
      resolveEncryptedRecipientHandshakeStatusSync({
        recipient: B,
        connectedAddresses: [B],
        incomingOffers: [],
        outgoingOffers: [],
      })
    ).toBe('ready')
  })

  it('needs_accept bei eingehendem Angebot', () => {
    expect(
      resolveEncryptedRecipientHandshakeStatusSync({
        recipient: B,
        connectedAddresses: [],
        incomingOffers: [{ sender: B, nonce: '1', source: 'mailbox' }],
        outgoingOffers: [],
      })
    ).toBe('needs_accept')
  })

  it('awaiting_peer bei ausgehendem Angebot', () => {
    expect(
      resolveEncryptedRecipientHandshakeStatusSync({
        recipient: B,
        connectedAddresses: [],
        incomingOffers: [],
        outgoingOffers: [{ recipient: B, nonce: '1', source: 'event' }],
      })
    ).toBe('awaiting_peer')
  })

  it('needs_handshake ohne Angebote', () => {
    expect(
      resolveEncryptedRecipientHandshakeStatusSync({
        recipient: B,
        connectedAddresses: [],
        incomingOffers: [],
        outgoingOffers: [],
      })
    ).toBe('needs_handshake')
  })
})

describe('encryptedHandshakeBlocksSend', () => {
  it('blockiert nur wenn nicht ready', () => {
    expect(encryptedHandshakeBlocksSend('ready')).toBe(false)
    expect(encryptedHandshakeBlocksSend('needs_handshake')).toBe(true)
    expect(encryptedHandshakeBlocksSend('awaiting_peer')).toBe(true)
  })
})
