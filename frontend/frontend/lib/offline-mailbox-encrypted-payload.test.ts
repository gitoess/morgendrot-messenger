import { describe, expect, it } from 'vitest'
import {
  isLegacyPlaintextEncryptedQueuePayload,
  isOfflineEncryptedWirePayload,
  parseOfflineEncryptedWirePayload,
  serializeOfflineEncryptedWirePayload,
} from '@/frontend/lib/offline-mailbox-encrypted-payload'

describe('offline-mailbox-encrypted-payload', () => {
  const sample = {
    v: 1 as const,
    ciphertextB64: 'YQ==',
    ivB64: 'Yg==',
    tagB64: 'Yw==',
    nonce: '42',
  }

  it('rejects plaintext legacy payload', () => {
    expect(isOfflineEncryptedWirePayload('[[MORG_MAILBOX_NONCE_V1:1]]hello')).toBe(false)
    expect(
      isLegacyPlaintextEncryptedQueuePayload('encrypted_send', true, '[[MORG_MAILBOX_NONCE_V1:1]]hello')
    ).toBe(true)
  })

  it('roundtrips v1 wire', () => {
    const json = serializeOfflineEncryptedWirePayload(sample)
    expect(isOfflineEncryptedWirePayload(json)).toBe(true)
    expect(parseOfflineEncryptedWirePayload(json)).toEqual(sample)
  })
})
