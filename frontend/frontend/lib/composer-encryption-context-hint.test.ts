import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { getComposerEncryptionContextHint } from './composer-encryption-context-hint'
import { writeRatchetExperimentEnabled } from '@/frontend/lib/ratchet-experiment'

describe('getComposerEncryptionContextHint (H.3o.6)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: {
        store: {} as Record<string, string>,
        getItem(k: string) {
          return this.store[k] ?? null
        },
        setItem(k: string, v: string) {
          this.store[k] = v
        },
        removeItem(k: string) {
          delete this.store[k]
        },
      },
      dispatchEvent: () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    } as unknown as Window & typeof globalThis)
    writeRatchetExperimentEnabled(false)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

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

  it('online Enc + Ratchet-Opt-in: Experiment-Hinweis', () => {
    writeRatchetExperimentEnabled(true)
    expect(getComposerEncryptionContextHint({ forcedTransport: 'internet', encrypted: true })).toMatch(
      /Double Ratchet/
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
