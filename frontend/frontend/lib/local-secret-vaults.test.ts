import { afterEach, describe, expect, it } from 'vitest'
import {
  lockLocalSecretVaults,
  purgeLocalSecretVaults,
  unlockLocalSecretVaults,
} from '@/frontend/lib/local-secret-vaults'
import { getNftKeycard, upsertNftKeycardSlot } from '@/frontend/lib/nft-keycard-local-store'
import { rememberPassphraseMessagePassphrase } from '@/frontend/lib/passphrase-message-local-store'
import { hasTeamBroadcastKey, createTeamBroadcastKey } from '@/frontend/lib/team-broadcast-key-store'
import { hasVaultPasswordSession } from '@/frontend/lib/vault-password-session'

const OID = '0x' + '11'.repeat(32)
const MB = '0x' + '22'.repeat(32)

describe('local-secret-vaults aggregator', () => {
  afterEach(() => {
    purgeLocalSecretVaults()
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('unlock hydriert Team-Key + NFT-Karte; Lock leert Session + RAM', async () => {
    const unlocked = await unlockLocalSecretVaults('vault-pass-99')
    expect(unlocked.ok).toBe(true)
    expect(hasVaultPasswordSession()).toBe(true)

    createTeamBroadcastKey(MB)
    upsertNftKeycardSlot({ objectId: OID, passphrase: 'slot-pass-88' })
    rememberPassphraseMessagePassphrase('MORG_PWMSG_V1|x', 'msg-pass-88')

    expect(hasTeamBroadcastKey(MB)).toBe(true)
    expect(getNftKeycard(OID)).toBeTruthy()

    lockLocalSecretVaults()
    expect(hasVaultPasswordSession()).toBe(false)
    expect(hasTeamBroadcastKey(MB)).toBe(false)
    expect(getNftKeycard(OID)).toBeNull()
  })

  it('lehnt zu kurzes Vault-Passwort ab', async () => {
    const r = await unlockLocalSecretVaults('short')
    expect(r.ok).toBe(false)
    expect(hasVaultPasswordSession()).toBe(false)
  })
})
