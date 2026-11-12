import { afterEach, describe, expect, it } from 'vitest'
import {
  fingerprintPassphraseMessageWire,
  flushPassphraseMessageVaultPersist,
  getDefaultPassphraseMessagePassphrase,
  hasEncryptedPassphraseMessageVault,
  lockPassphraseMessageVault,
  lookupPassphraseMessagePassphrase,
  PASSPHRASE_MESSAGE_ENC_LS_KEY,
  purgePassphraseMessageVault,
  readPassphraseNftStrongGateEnabled,
  readPassphraseProtectEnabled,
  readPassphraseZeitkapselModeEnabled,
  readZeitkapselLastNftObjectId,
  rememberPassphraseMessagePassphrase,
  resolvePassphraseForProtectSend,
  setDefaultPassphraseMessagePassphrase,
  unlockPassphraseMessageVault,
  writePassphraseProtectEnabled,
  writePassphraseReuseEnabled,
  writePassphraseZeitkapselModeEnabled,
  writeZeitkapselLastNftObjectId,
} from '@/frontend/lib/passphrase-message-local-store'

describe('fingerprintPassphraseMessageWire', () => {
  it('ist stabil und unterscheidet Inhalte', () => {
    const a = fingerprintPassphraseMessageWire('MORG_PWMSG_V1:aaa')
    const b = fingerprintPassphraseMessageWire('MORG_PWMSG_V1:aaa')
    const c = fingerprintPassphraseMessageWire('MORG_PWMSG_V1:bbb')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})

describe('resolvePassphraseForProtectSend', () => {
  afterEach(() => {
    purgePassphraseMessageVault()
    window.localStorage.clear()
  })

  it('ohne Reuse: Feld/Default gilt; ohne Session kein Auto-Würfeln', () => {
    writePassphraseReuseEnabled(false)
    const a = resolvePassphraseForProtectSend(() => 'fresh-pass-aaaa')
    expect(a).toEqual({ passphrase: '', reused: false })
    expect(getDefaultPassphraseMessagePassphrase()).toBeNull()
  })

  it('ohne Reuse mit Vault: erzeugt Default (Neu-würfeln-Feld)', async () => {
    await unlockPassphraseMessageVault('vault-pass-99')
    writePassphraseReuseEnabled(false)
    const a = resolvePassphraseForProtectSend(() => 'fresh-pass-aaaa')
    expect(a).toEqual({ passphrase: 'fresh-pass-aaaa', reused: false })
    expect(getDefaultPassphraseMessagePassphrase()).toBe('fresh-pass-aaaa')
  })

  it('mit Reuse: behält Geräte-Standard', async () => {
    await unlockPassphraseMessageVault('vault-pass-99')
    writePassphraseReuseEnabled(true)
    setDefaultPassphraseMessagePassphrase('shared-pass-9999')
    const a = resolvePassphraseForProtectSend(() => 'should-not-use')
    const b = resolvePassphraseForProtectSend(() => 'should-not-use')
    expect(a).toEqual({ passphrase: 'shared-pass-9999', reused: true })
    expect(b.passphrase).toBe(a.passphrase)
  })

  it('mit Reuse ohne Default: erzeugt und speichert', async () => {
    await unlockPassphraseMessageVault('vault-pass-99')
    writePassphraseReuseEnabled(true)
    const a = resolvePassphraseForProtectSend(() => 'brand-new-pass1')
    expect(a).toEqual({ passphrase: 'brand-new-pass1', reused: true })
    expect(getDefaultPassphraseMessagePassphrase()).toBe('brand-new-pass1')
  })
})

describe('passphrase message vault enc', () => {
  afterEach(() => {
    purgePassphraseMessageVault()
    window.localStorage.clear()
  })

  it('persistiert verschlüsselt, überlebt Lock+Unlock, Purge löscht Sidecar', async () => {
    const wire = 'MORG_PWMSG_V1:secret-wire'
    const unlocked = await unlockPassphraseMessageVault('vault-pass-99')
    expect(unlocked.ok).toBe(true)
    rememberPassphraseMessagePassphrase(wire, 'msg-pass-8888')
    setDefaultPassphraseMessagePassphrase('shared-pass-7777')
    await flushPassphraseMessageVaultPersist()
    expect(hasEncryptedPassphraseMessageVault()).toBe(true)
    expect(window.localStorage.getItem(PASSPHRASE_MESSAGE_ENC_LS_KEY)).toContain(
      'morgendrot.passphrase-msg.enc.v1'
    )
    expect(window.localStorage.getItem('morgendrot.passphraseMsg.v1')).toBeNull()

    lockPassphraseMessageVault()
    expect(lookupPassphraseMessagePassphrase(wire)).toBeNull()
    expect(getDefaultPassphraseMessagePassphrase()).toBeNull()
    expect(hasEncryptedPassphraseMessageVault()).toBe(true)

    const again = await unlockPassphraseMessageVault('vault-pass-99')
    expect(again.ok).toBe(true)
    expect(lookupPassphraseMessagePassphrase(wire)).toBe('msg-pass-8888')
    expect(getDefaultPassphraseMessagePassphrase()).toBe('shared-pass-7777')

    purgePassphraseMessageVault()
    expect(hasEncryptedPassphraseMessageVault()).toBe(false)
    expect(lookupPassphraseMessagePassphrase(wire)).toBeNull()
  })

  it('migriert Legacy-Klartext beim Unlock', async () => {
    const wire = 'MORG_PWMSG_V1:legacy'
    const fp = fingerprintPassphraseMessageWire(wire)
    window.localStorage.setItem(
      'morgendrot.passphraseMsg.v1',
      JSON.stringify({ [fp]: 'legacy-pass-12' })
    )
    window.localStorage.setItem('morgendrot.passphraseMsg.default.v1', 'legacy-default-9')
    const unlocked = await unlockPassphraseMessageVault('vault-pass-99')
    expect(unlocked.ok).toBe(true)
    if (unlocked.ok) expect(unlocked.migratedLegacy).toBe(true)
    expect(lookupPassphraseMessagePassphrase(wire)).toBe('legacy-pass-12')
    expect(getDefaultPassphraseMessagePassphrase()).toBe('legacy-default-9')
    expect(window.localStorage.getItem('morgendrot.passphraseMsg.v1')).toBeNull()
    expect(hasEncryptedPassphraseMessageVault()).toBe(true)
  })

  it('lehnt falsches Vault-Passwort ab', async () => {
    await unlockPassphraseMessageVault('vault-pass-99')
    rememberPassphraseMessagePassphrase('MORG_PWMSG_V1:x', 'msg-pass-8888')
    await flushPassphraseMessageVaultPersist()
    lockPassphraseMessageVault()
    const bad = await unlockPassphraseMessageVault('wrong-password')
    expect(bad.ok).toBe(false)
  })
})

describe('Zeitkapsel-Nachricht Composer-Flags', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('schaltet Passphrase-Schutz aus und Strong-Gate an', () => {
    writePassphraseProtectEnabled(true)
    writePassphraseZeitkapselModeEnabled(true)
    expect(readPassphraseZeitkapselModeEnabled()).toBe(true)
    expect(readPassphraseProtectEnabled()).toBe(false)
    expect(readPassphraseNftStrongGateEnabled()).toBe(true)
  })

  it('Passphrase-Schutz schaltet Zeitkapsel-Modus aus', () => {
    writePassphraseZeitkapselModeEnabled(true)
    writePassphraseProtectEnabled(true)
    expect(readPassphraseProtectEnabled()).toBe(true)
    expect(readPassphraseZeitkapselModeEnabled()).toBe(false)
  })

  it('merkt letzte NFTGATE-Object-ID für CTA', () => {
    const oid = `0x${'ab'.repeat(32)}`
    writeZeitkapselLastNftObjectId(oid)
    expect(readZeitkapselLastNftObjectId()).toBe(oid)
    writeZeitkapselLastNftObjectId(null)
    expect(readZeitkapselLastNftObjectId()).toBeNull()
  })
})
