import { afterEach, describe, expect, it } from 'vitest'
import {
  fingerprintPassphraseMessageWire,
  getDefaultPassphraseMessagePassphrase,
  resolvePassphraseForProtectSend,
  setDefaultPassphraseMessagePassphrase,
  writePassphraseReuseEnabled,
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
    window.localStorage.clear()
  })

  it('ohne Reuse: frische Passphrase, nicht persistiert als Default', () => {
    writePassphraseReuseEnabled(false)
    const a = resolvePassphraseForProtectSend(() => 'fresh-pass-aaaa')
    expect(a).toEqual({ passphrase: 'fresh-pass-aaaa', reused: false })
    expect(getDefaultPassphraseMessagePassphrase()).toBeNull()
  })

  it('mit Reuse: behält Geräte-Standard', () => {
    writePassphraseReuseEnabled(true)
    setDefaultPassphraseMessagePassphrase('shared-pass-9999')
    const a = resolvePassphraseForProtectSend(() => 'should-not-use')
    const b = resolvePassphraseForProtectSend(() => 'should-not-use')
    expect(a).toEqual({ passphrase: 'shared-pass-9999', reused: true })
    expect(b.passphrase).toBe(a.passphrase)
  })

  it('mit Reuse ohne Default: erzeugt und speichert', () => {
    writePassphraseReuseEnabled(true)
    const a = resolvePassphraseForProtectSend(() => 'brand-new-pass1')
    expect(a).toEqual({ passphrase: 'brand-new-pass1', reused: true })
    expect(getDefaultPassphraseMessagePassphrase()).toBe('brand-new-pass1')
  })
})
