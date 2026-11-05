import { describe, expect, it, afterEach } from 'vitest'
import { encryptPassphraseMessage } from '@/frontend/lib/passphrase-message-crypto'
import {
  classifyPastedWire,
  decryptPastedPassphraseWire,
  suggestPassphraseForPastedWire,
} from '@/frontend/lib/wire-paste-import'
import {
  setDefaultPassphraseMessagePassphrase,
  writePassphraseReuseEnabled,
} from '@/frontend/lib/passphrase-message-local-store'

describe('wire-paste-import', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('classifies PWMSG vs unknown', () => {
    expect(classifyPastedWire('MORG_PWMSG_V1:abc')).toBe('passphrase-msg')
    expect(classifyPastedWire('hello')).toBe('unknown')
  })

  it('decrypts pasted passphrase wire', async () => {
    const { wire, passphrase } = await encryptPassphraseMessage('Paste-Test', 'paste-pass-1234')
    const r = await decryptPastedPassphraseWire(wire, passphrase)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.plain).toBe('Paste-Test')
  })

  it('suggests default reuse passphrase', () => {
    writePassphraseReuseEnabled(true)
    setDefaultPassphraseMessagePassphrase('shared-pass-7777')
    expect(suggestPassphraseForPastedWire('MORG_PWMSG_V1:x')).toBe('shared-pass-7777')
  })
})
