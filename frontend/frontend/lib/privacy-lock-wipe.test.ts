import { afterEach, describe, expect, it } from 'vitest'
import {
  flushEvidencePassphraseVaultPersist,
  hasEncryptedEvidencePassphraseVault,
  lookupEvidencePassphrase,
  purgeEvidencePassphraseVault,
  rememberEvidencePassphrase,
  unlockEvidencePassphraseVault,
} from '@/frontend/lib/evidence-passphrase-local-store'
import {
  flushPassphraseMessageVaultPersist,
  hasEncryptedPassphraseMessageVault,
  lookupPassphraseMessagePassphrase,
  PASSPHRASE_MESSAGE_ENC_LS_KEY,
  purgePassphraseMessageVault,
  rememberPassphraseMessagePassphrase,
  unlockPassphraseMessageVault,
} from '@/frontend/lib/passphrase-message-local-store'
import { purgeNftKeycardVault } from '@/frontend/lib/nft-keycard-local-store'
import { wipeLocalPassphraseStoresOnLock } from '@/frontend/lib/privacy-lock-wipe'
import { purgeTeamBroadcastKeyVault } from '@/frontend/lib/team-broadcast-key-store'
import { hasVaultPasswordSession, setVaultPasswordSession } from '@/frontend/lib/vault-password-session'

describe('wipeLocalPassphraseStoresOnLock', () => {
  afterEach(() => {
    purgePassphraseMessageVault()
    purgeEvidencePassphraseVault()
    purgeTeamBroadcastKeyVault()
    purgeNftKeycardVault()
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('clears RAM + tab backups but keeps encrypted sidecars', async () => {
    setVaultPasswordSession('vault-pass-99')
    await unlockPassphraseMessageVault('vault-pass-99')
    await unlockEvidencePassphraseVault('vault-pass-99')

    const wire = 'MORG_PWMSG_V1|abc'
    rememberPassphraseMessagePassphrase(wire, 'test-pass-34')
    rememberEvidencePassphrase({
      objectId: '0x' + 'ab'.repeat(32),
      passphrase: 'test-pass-12',
    })
    // Vor Enc-Flush liegt Klartext kurz im Tab-Backup — Lock muss das löschen.
    expect(window.sessionStorage.getItem('morgendrot.passphraseMsg.tab.v1')).toBeTruthy()
    await flushPassphraseMessageVaultPersist()
    await flushEvidencePassphraseVaultPersist()

    expect(hasEncryptedPassphraseMessageVault()).toBe(true)
    expect(hasEncryptedEvidencePassphraseVault()).toBe(true)
    expect(lookupPassphraseMessagePassphrase(wire)).toBe('test-pass-34')
    expect(lookupEvidencePassphrase({ objectId: '0x' + 'ab'.repeat(32) })).toBe('test-pass-12')

    // Nach erneutem Remember ohne Flush: Tab wieder befüllt, dann Lock.
    rememberPassphraseMessagePassphrase(wire, 'test-pass-34')
    expect(window.sessionStorage.getItem('morgendrot.passphraseMsg.tab.v1')).toBeTruthy()
    wipeLocalPassphraseStoresOnLock()

    expect(lookupPassphraseMessagePassphrase(wire)).toBeNull()
    expect(lookupEvidencePassphrase({ objectId: '0x' + 'ab'.repeat(32) })).toBeNull()
    expect(hasVaultPasswordSession()).toBe(false)
    expect(window.sessionStorage.getItem('morgendrot.passphraseMsg.tab.v1')).toBeNull()
    expect(window.localStorage.getItem(PASSPHRASE_MESSAGE_ENC_LS_KEY)).toBeTruthy()
    expect(hasEncryptedEvidencePassphraseVault()).toBe(true)
  })
})
