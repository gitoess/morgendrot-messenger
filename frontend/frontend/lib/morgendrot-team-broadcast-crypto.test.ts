import { describe, expect, it } from 'vitest'
import {
  buildTeamBroadcastAad,
  decryptTeamBroadcastPayload,
  encryptTeamBroadcastPayload,
  generateTeamBroadcastKeyRaw,
} from '@morgendrot/shared/morgendrot-team-broadcast-crypto'

const MB = '0x' + 'a'.repeat(64)

describe('morgendrot-team-broadcast-crypto (H.23 B1)', () => {
  it('roundtrip AES-GCM mit AAD', async () => {
    const key = generateTeamBroadcastKeyRaw()
    const aad = buildTeamBroadcastAad({ teamMailboxObjectId: MB, groupId: 'g1', keyEpoch: 1 })
    const enc = await encryptTeamBroadcastPayload(key, 'Hallo Team', aad)
    const plain = await decryptTeamBroadcastPayload(key, enc.ciphertext, enc.iv, enc.tag, aad)
    expect(plain).toBe('Hallo Team')
  })

  it('falsche AAD scheitert', async () => {
    const key = generateTeamBroadcastKeyRaw()
    const aad = buildTeamBroadcastAad({ teamMailboxObjectId: MB, groupId: 'g1', keyEpoch: 1 })
    const enc = await encryptTeamBroadcastPayload(key, 'secret', aad)
    const wrong = buildTeamBroadcastAad({ teamMailboxObjectId: MB, groupId: 'g2', keyEpoch: 1 })
    await expect(
      decryptTeamBroadcastPayload(key, enc.ciphertext, enc.iv, enc.tag, wrong)
    ).rejects.toThrow()
  })
})
