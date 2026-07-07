import { describe, expect, it } from 'vitest'
import { buildStoreTeamEncryptedBroadcastTransaction } from './team-encrypted-broadcast-txb'

const PKG = '0x' + '1'.repeat(64)
const MB = '0x' + '2'.repeat(64)
const SENDER = '0x' + '3'.repeat(64)

describe('buildStoreTeamEncryptedBroadcastTransaction', () => {
  it('baut Move-Call store_team_encrypted_broadcast', () => {
    const txb = buildStoreTeamEncryptedBroadcastTransaction({
      packageId: PKG,
      teamMailboxObjectId: MB,
      senderAddress: SENDER,
      ciphertext: new Uint8Array([1, 2, 3]),
      iv: new Uint8Array(12).fill(9),
      tag: new Uint8Array(16).fill(7),
      keyEpoch: 1n,
      nonce: 42n,
      ttlDays: 30n,
    })
    const json = txb.getData() as { commands?: Array<{ MoveCall?: { function?: string } }> }
    const fn = json.commands?.[0]?.MoveCall?.function ?? ''
    expect(fn).toContain('store_team_encrypted_broadcast')
  })
})
