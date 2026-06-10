import { describe, expect, it } from 'vitest'
import { buildStoreTeamPlaintextBroadcastTransaction } from './team-broadcast-txb'

const PKG = '0x' + 'a'.repeat(64)
const MB = '0x' + 'b'.repeat(64)
const SENDER = '0x' + 'c'.repeat(64)

describe('buildStoreTeamPlaintextBroadcastTransaction', () => {
  it('baut PTB ohne recipient-Argument', () => {
    const txb = buildStoreTeamPlaintextBroadcastTransaction({
      packageId: PKG,
      teamMailboxObjectId: MB,
      senderAddress: SENDER,
      plaintextUtf8: new TextEncoder().encode('Hallo Team'),
      nonce: 42n,
      ttlDays: 30n,
    })
    const json = txb.getData() as { commands?: { MoveCall?: { function?: string; arguments?: unknown[] } }[] }
    const move = json.commands?.find((c) => c.MoveCall)?.MoveCall
    expect(move?.function).toContain('store_team_plaintext_broadcast')
    expect(move?.arguments?.length).toBe(4)
  })

  it('lehnt gleiche Package- und Mailbox-ID ab', () => {
    expect(() =>
      buildStoreTeamPlaintextBroadcastTransaction({
        packageId: PKG,
        teamMailboxObjectId: PKG,
        senderAddress: SENDER,
        plaintextUtf8: new Uint8Array([1]),
        nonce: 1n,
        ttlDays: 1n,
      })
    ).toThrow(/PACKAGE_ID/)
  })
})
