import { describe, expect, it } from 'vitest'
import { fingerprintPassphraseMessageWire } from '@/frontend/lib/passphrase-message-local-store'

describe('fingerprintPassphraseMessageWire', () => {
  it('ist stabil und unterscheidet Inhalte', () => {
    const a = fingerprintPassphraseMessageWire('MORG_PWMSG_V1:aaa')
    const b = fingerprintPassphraseMessageWire('MORG_PWMSG_V1:aaa')
    const c = fingerprintPassphraseMessageWire('MORG_PWMSG_V1:bbb')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})
