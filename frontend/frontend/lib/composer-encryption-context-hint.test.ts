import { describe, expect, it } from 'vitest'
import { getComposerEncryptionContextHint } from './composer-encryption-context-hint'

describe('getComposerEncryptionContextHint (H.3o.6)', () => {
  it('funk klartext: kein Zusatz-Hinweis (Details im Handbuch / Meshtastic-Web)', () => {
    expect(getComposerEncryptionContextHint({ forcedTransport: 'mesh', encrypted: false })).toBeNull()
  })

  it('funk + schloss: warnt vor Mismatch', () => {
    expect(getComposerEncryptionContextHint({ forcedTransport: 'mesh', encrypted: true })).toMatch(/Schloss/)
  })

  it('online verschlüsselt: transport-strong Hinweis', () => {
    expect(getComposerEncryptionContextHint({ forcedTransport: 'internet', encrypted: true })).toMatch(
      /transport-strong/
    )
  })

  it('online klartext', () => {
    expect(getComposerEncryptionContextHint({ forcedTransport: 'internet', encrypted: false })).toMatch(/Klartext/)
  })
})
