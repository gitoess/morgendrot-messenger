import { describe, expect, it } from 'vitest'
import { getComposerEncryptionContextHint } from './composer-encryption-context-hint'

describe('getComposerEncryptionContextHint', () => {
  it('liefert keinen Erklärtext (selbsterklärende UI)', () => {
    expect(getComposerEncryptionContextHint({ forcedTransport: 'mesh', encrypted: false })).toBeNull()
    expect(getComposerEncryptionContextHint({ forcedTransport: 'mesh', encrypted: true })).toBeNull()
    expect(getComposerEncryptionContextHint({ forcedTransport: 'internet', encrypted: true })).toBeNull()
    expect(getComposerEncryptionContextHint({ forcedTransport: 'internet', encrypted: false })).toBeNull()
  })
})
