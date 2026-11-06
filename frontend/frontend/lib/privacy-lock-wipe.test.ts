import { afterEach, describe, expect, it } from 'vitest'
import { rememberEvidencePassphrase } from '@/frontend/lib/evidence-passphrase-local-store'
import {
  fingerprintPassphraseMessageWire,
  flushPassphraseMessageVaultPersist,
  hasEncryptedPassphraseMessageVault,
  lookupPassphraseMessagePassphrase,
  PASSPHRASE_MESSAGE_ENC_LS_KEY,
  purgePassphraseMessageVault,
  rememberPassphraseMessagePassphrase,
  unlockPassphraseMessageVault,
} from '@/frontend/lib/passphrase-message-local-store'
import { wipeLocalPassphraseStoresOnLock } from '@/frontend/lib/privacy-lock-wipe'

describe('wipeLocalPassphraseStoresOnLock', () => {
  afterEach(() => {
    purgePassphraseMessageVault()
    window.localStorage.clear()
  })

  it('clears RAM passphrases but keeps encrypted sidecar; ImageNFT untouched', async () => {
    rememberEvidencePassphrase({
      objectId: '0x' + 'ab'.repeat(32),
      passphrase: 'test-pass-12',
    })
    const wire = 'MORG_PWMSG_V1|abc'
    const unlocked = await unlockPassphraseMessageVault('vault-pass-99')
    expect(unlocked.ok).toBe(true)
    rememberPassphraseMessagePassphrase(wire, 'test-pass-34')
    await flushPassphraseMessageVaultPersist()
    expect(window.localStorage.getItem('morgendrot.evidenceImage.passphrases.v1')).toBeTruthy()
    expect(hasEncryptedPassphraseMessageVault()).toBe(true)
    expect(lookupPassphraseMessagePassphrase(wire)).toBe('test-pass-34')
    expect(fingerprintPassphraseMessageWire(wire)).toMatch(/^fnv:/)

    wipeLocalPassphraseStoresOnLock()

    expect(window.localStorage.getItem('morgendrot.evidenceImage.passphrases.v1')).toBeTruthy()
    expect(lookupPassphraseMessagePassphrase(wire)).toBeNull()
    expect(window.localStorage.getItem(PASSPHRASE_MESSAGE_ENC_LS_KEY)).toBeTruthy()
    expect(window.localStorage.getItem('morgendrot.passphraseMsg.v1')).toBeNull()
  })
})
