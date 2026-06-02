import { describe, expect, it } from 'vitest'
import { buildPurgeHandshakeTransaction } from './purge-handshake-txb'

describe('buildPurgeHandshakeTransaction', () => {
  const pkg = '0x' + '11'.repeat(32)
  const mb = '0x' + '22'.repeat(32)
  const me = '0x' + '33'.repeat(32)
  const peer = '0x' + '44'.repeat(32)

  it('baut purge_handshake', () => {
    const txb = buildPurgeHandshakeTransaction({
      packageId: pkg,
      senderAddress: me,
      mailboxObjectId: mb,
      recipient: me,
      peerSender: peer,
    })
    expect(txb).toBeTruthy()
  })

  it('baut purge_handshake_private', () => {
    const txb = buildPurgeHandshakeTransaction({
      packageId: pkg,
      senderAddress: me,
      mailboxObjectId: mb,
      recipient: me,
      peerSender: peer,
      privateMailbox: true,
    })
    expect(txb).toBeTruthy()
  })
})
