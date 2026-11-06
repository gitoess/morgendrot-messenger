import { afterEach, describe, expect, it } from 'vitest'
import {
  EVIDENCE_PASSPHRASE_ENC_LS_KEY,
  flushEvidencePassphraseVaultPersist,
  hasEncryptedEvidencePassphraseVault,
  lockEvidencePassphraseVault,
  lookupEvidencePassphrase,
  purgeEvidencePassphraseVault,
  rememberEvidencePassphrase,
  unlockEvidencePassphraseVault,
} from '@/frontend/lib/evidence-passphrase-local-store'
import { setVaultPasswordSession } from '@/frontend/lib/vault-password-session'

const OID = '0x' + 'cd'.repeat(32)

describe('evidence-passphrase vault', () => {
  afterEach(() => {
    purgeEvidencePassphraseVault()
    window.localStorage.clear()
  })

  it('persistiert verschlüsselt und überlebt Lock+Unlock', async () => {
    setVaultPasswordSession('vault-pass-99')
    await unlockEvidencePassphraseVault('vault-pass-99')
    rememberEvidencePassphrase({ objectId: OID, passphrase: 'nft-pass-8888' })
    await flushEvidencePassphraseVaultPersist()
    expect(hasEncryptedEvidencePassphraseVault()).toBe(true)
    expect(window.localStorage.getItem(EVIDENCE_PASSPHRASE_ENC_LS_KEY)).toContain(
      'morgendrot.evidence-pass.enc.v1'
    )
    expect(window.localStorage.getItem('morgendrot.evidenceImage.passphrases.v1')).toBeNull()

    lockEvidencePassphraseVault()
    expect(lookupEvidencePassphrase({ objectId: OID })).toBeNull()

    setVaultPasswordSession('vault-pass-99')
    const again = await unlockEvidencePassphraseVault('vault-pass-99')
    expect(again.ok).toBe(true)
    expect(lookupEvidencePassphrase({ objectId: OID })).toBe('nft-pass-8888')
  })

  it('migriert Legacy-Klartext', async () => {
    window.localStorage.setItem(
      'morgendrot.evidenceImage.passphrases.v1',
      JSON.stringify({ [OID]: 'legacy-nft-99' })
    )
    setVaultPasswordSession('vault-pass-99')
    const unlocked = await unlockEvidencePassphraseVault('vault-pass-99')
    expect(unlocked.ok).toBe(true)
    if (unlocked.ok) expect(unlocked.migratedLegacy).toBe(true)
    expect(lookupEvidencePassphrase({ objectId: OID })).toBe('legacy-nft-99')
    expect(window.localStorage.getItem('morgendrot.evidenceImage.passphrases.v1')).toBeNull()
  })
})
