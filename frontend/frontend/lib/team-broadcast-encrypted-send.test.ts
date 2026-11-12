import { afterEach, describe, expect, it } from 'vitest'
import { encryptTeamBroadcastPlaintext } from '@/frontend/lib/team-broadcast-encrypted-send'
import {
  TEAM_BROADCAST_KEY_MISSING_MSG,
  createTeamBroadcastKey,
} from '@/frontend/lib/team-broadcast-key-store'
import { setVaultPasswordSession } from '@/frontend/lib/vault-password-session'

const MB = `0x${'cd'.repeat(32)}`

describe('encryptTeamBroadcastPlaintext', () => {
  afterEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('ohne Key: Fehler statt Auto-Generate', async () => {
    await expect(
      encryptTeamBroadcastPlaintext({
        teamMailboxObjectId: MB,
        groupId: 'g1',
        plaintextUtf8: 'hi',
      })
    ).rejects.toThrow(TEAM_BROADCAST_KEY_MISSING_MSG)
  })

  it('mit Key: liefert Ciphertext', async () => {
    setVaultPasswordSession('vault-pass-99')
    createTeamBroadcastKey(MB)
    const enc = await encryptTeamBroadcastPlaintext({
      teamMailboxObjectId: MB,
      groupId: 'g1',
      plaintextUtf8: 'geheim',
    })
    expect(enc.ciphertext.length).toBeGreaterThan(0)
    expect(enc.keyEpoch).toBe(1)
  })
})
