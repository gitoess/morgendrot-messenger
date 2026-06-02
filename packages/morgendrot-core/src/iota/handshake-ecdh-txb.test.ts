import { describe, expect, it } from 'vitest'
import { buildStoreEcdhInitTransaction } from './handshake-ecdh-txb'

describe('buildStoreEcdhInitTransaction', () => {
  const pkg = '0x' + '11'.repeat(32)
  const mb = '0x' + '22'.repeat(32)
  const sender = '0x' + '33'.repeat(32)
  const recipient = '0x' + '44'.repeat(32)
  const pub = new Uint8Array(65)
  pub[0] = 0x04

  it('mailbox: store_ecdh_init', () => {
    const txb = buildStoreEcdhInitTransaction({
      packageId: pkg,
      mailboxObjectId: mb,
      senderAddress: sender,
      recipientAddress: recipient,
      pubKeyRaw: pub,
      nonce: 1n,
      ttlDays: 30n,
    })
    expect(txb.getData().commands.length).toBeGreaterThan(0)
  })

  it('ohne Mailbox: emit_ecdh_init', () => {
    const txb = buildStoreEcdhInitTransaction({
      packageId: pkg,
      senderAddress: sender,
      recipientAddress: recipient,
      pubKeyRaw: pub,
      nonce: 2n,
      ttlDays: 30n,
    })
    expect(txb.getData().commands.length).toBeGreaterThan(0)
  })
})
