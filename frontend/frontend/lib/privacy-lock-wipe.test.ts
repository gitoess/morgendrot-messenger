import { afterEach, describe, expect, it } from 'vitest'
import { rememberEvidencePassphrase } from '@/frontend/lib/evidence-passphrase-local-store'
import {
  fingerprintPassphraseMessageWire,
  rememberPassphraseMessagePassphrase,
} from '@/frontend/lib/passphrase-message-local-store'
import { wipeLocalPassphraseStoresOnLock } from '@/frontend/lib/privacy-lock-wipe'

describe('wipeLocalPassphraseStoresOnLock', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('removes evidence + passphrase-message stores', () => {
    rememberEvidencePassphrase({
      objectId: '0x' + 'ab'.repeat(32),
      passphrase: 'test-pass-12',
    })
    const wire = 'MORG_PWMSG_V1|abc'
    rememberPassphraseMessagePassphrase(wire, 'test-pass-34')
    expect(window.localStorage.getItem('morgendrot.evidenceImage.passphrases.v1')).toBeTruthy()
    expect(window.localStorage.getItem('morgendrot.passphraseMsg.v1')).toBeTruthy()
    expect(fingerprintPassphraseMessageWire(wire)).toMatch(/^fnv:/)

    wipeLocalPassphraseStoresOnLock()

    expect(window.localStorage.getItem('morgendrot.evidenceImage.passphrases.v1')).toBeNull()
    expect(window.localStorage.getItem('morgendrot.passphraseMsg.v1')).toBeNull()
  })
})
