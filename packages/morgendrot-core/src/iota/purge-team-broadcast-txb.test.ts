import { describe, expect, it } from 'vitest'
import { buildPurgeTeamPlaintextBroadcastTransaction } from './purge-team-broadcast-txb'

describe('buildPurgeTeamPlaintextBroadcastTransaction', () => {
  const pkg = '0x' + '11'.repeat(32)
  const teamMb = '0x' + '22'.repeat(32)
  const me = '0x' + '33'.repeat(32)
  const broadcaster = '0x' + '44'.repeat(32)

  it('baut Transaction', () => {
    const txb = buildPurgeTeamPlaintextBroadcastTransaction({
      packageId: pkg,
      senderAddress: me,
      teamMailboxObjectId: teamMb,
      broadcastSender: broadcaster,
      nonce: 1781188021933n,
    })
    expect(txb).toBeTruthy()
  })

  it('wirft bei teamMb = PACKAGE_ID', () => {
    expect(() =>
      buildPurgeTeamPlaintextBroadcastTransaction({
        packageId: pkg,
        senderAddress: me,
        teamMailboxObjectId: pkg,
        broadcastSender: broadcaster,
        nonce: 1n,
      })
    ).toThrow(/PACKAGE_ID/)
  })
})
