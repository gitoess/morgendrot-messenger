import { describe, expect, it } from 'vitest'
import { getComposerEncryptionContextHint } from './composer-encryption-context-hint'

describe('getComposerEncryptionContextHint (H.3o.6)', () => {
  it('funk klartext: kein Zusatz-Hinweis (Details im Handbuch / Meshtastic-Web)', () => {
    expect(getComposerEncryptionContextHint({ forcedTransport: 'mesh', encrypted: false })).toBeNull()
  })

  it('funk + schloss: warnt vor Mismatch', () => {
    expect(getComposerEncryptionContextHint({ forcedTransport: 'mesh', encrypted: true })).toMatch(/Schloss/)
  })

  it('online verschlüsselt: Session Keys+ Hinweis', () => {
    expect(getComposerEncryptionContextHint({ forcedTransport: 'internet', encrypted: true })).toMatch(
      /Session Keys\+/
    )
  })

  it('online klartext', () => {
    expect(getComposerEncryptionContextHint({ forcedTransport: 'internet', encrypted: false })).toMatch(/Klartext/)
  })

  it('G2 gruppe online ohne Team-Postfach', () => {
    expect(
      getComposerEncryptionContextHint({
        forcedTransport: 'internet',
        encrypted: false,
        isGroupChannel: true,
        groupTeamBroadcastReady: false,
      })
    ).toMatch(/Team-Postfach/)
  })

  it('G2 gruppe funk klartext', () => {
    expect(
      getComposerEncryptionContextHint({
        forcedTransport: 'mesh',
        encrypted: false,
        isGroupChannel: true,
      })
    ).toMatch(/Funk/)
  })
})
