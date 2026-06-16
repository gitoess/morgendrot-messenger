/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyDirectIotaMnemonicSession,
  clearDirectIotaSessionSigner,
  clearPersistedDirectIotaSessionSigner,
  disableDirectIotaTabSessionPersistForVitest,
  drainDirectIotaTabSessionPersistForTests,
  enableDirectIotaTabSessionPersistForVitest,
  getDirectIotaSessionSignerAddress,
  hasPersistedDirectIotaSessionSigner,
  persistDirectIotaSessionSignerEncrypted,
  resetDirectIotaMnemonicSessionModuleForTests,
  restoreDirectIotaSessionSignerFromEncryptedStorage,
  restoreDirectIotaSessionSignerFromTabSession,
  restoreDirectIotaSessionSignerFromTabSessionAsync,
  whenDirectIotaTabSessionPersistIdle,
} from '@/frontend/lib/direct-iota-mnemonic-session'

describe('direct-iota-mnemonic-session encrypted local storage', () => {
  const store: Record<string, string> = {}
  const sessionStore: Record<string, string> = {}
  const rawHexSecret = '11'.repeat(32)

  beforeEach(async () => {
    await drainDirectIotaTabSessionPersistForTests()
    resetDirectIotaMnemonicSessionModuleForTests()
    enableDirectIotaTabSessionPersistForVitest()
    Object.keys(store).forEach((k) => delete store[k])
    Object.keys(sessionStore).forEach((k) => delete sessionStore[k])
    clearDirectIotaSessionSigner()
    vi.stubGlobal(
      'window',
      {
        localStorage: {
          getItem: (k: string) => (k in store ? store[k] : null),
          setItem: (k: string, v: string) => {
            store[k] = v
          },
          removeItem: (k: string) => {
            delete store[k]
          },
        } as Storage,
        sessionStorage: {
          getItem: (k: string) => (k in sessionStore ? sessionStore[k] : null),
          setItem: (k: string, v: string) => {
            sessionStore[k] = v
          },
          removeItem: (k: string) => {
            delete sessionStore[k]
          },
        } as Storage,
      } as Window & typeof globalThis
    )
  })

  afterEach(async () => {
    await drainDirectIotaTabSessionPersistForTests()
    disableDirectIotaTabSessionPersistForVitest()
    vi.unstubAllGlobals()
  })

  it('persists and restores signer with password', async () => {
    const applied = applyDirectIotaMnemonicSession(rawHexSecret)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return

    const saved = await persistDirectIotaSessionSignerEncrypted({
      signerImportRaw: rawHexSecret,
      password: 'local-secret-2026',
    })
    expect(saved.ok).toBe(true)
    expect(hasPersistedDirectIotaSessionSigner()).toBe(true)

    clearDirectIotaSessionSigner()
    expect(getDirectIotaSessionSignerAddress()).toBeNull()

    const restored = await restoreDirectIotaSessionSignerFromEncryptedStorage({
      password: 'local-secret-2026',
    })
    expect(restored.ok).toBe(true)
    if (restored.ok) expect(restored.address).toBe(applied.address)
  })

  it('rejects wrong password and keeps signer unset', async () => {
    const saved = await persistDirectIotaSessionSignerEncrypted({
      signerImportRaw: rawHexSecret,
      password: 'correct-pass-2026',
    })
    expect(saved.ok).toBe(true)

    clearDirectIotaSessionSigner()
    const restored = await restoreDirectIotaSessionSignerFromEncryptedStorage({
      password: 'wrong-pass-2026',
    })
    expect(restored.ok).toBe(false)
    expect(getDirectIotaSessionSignerAddress()).toBeNull()
  })

  it('restores signer from encrypted tab session after RAM clear', async () => {
    const applied = applyDirectIotaMnemonicSession(rawHexSecret)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    clearDirectIotaSessionSigner()
    expect(getDirectIotaSessionSignerAddress()).toBeNull()

    await whenDirectIotaTabSessionPersistIdle()

    const restored = await restoreDirectIotaSessionSignerFromTabSessionAsync()
    expect(restored.ok).toBe(true)
    if (restored.ok) expect(restored.address).toBe(applied.address)
    expect(getDirectIotaSessionSignerAddress()).not.toBeNull()
    expect(sessionStore['morgendrot.directIotaSigner.tab.v1']).toBeUndefined()
    expect(sessionStore['morgendrot.directIotaSigner.tabEnc.v1']).toBeTruthy()
  })

  it('restores signer from legacy plaintext tab session', async () => {
    const applied = applyDirectIotaMnemonicSession(rawHexSecret)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    sessionStore['morgendrot.directIotaSigner.tab.v1'] = rawHexSecret
    delete sessionStore['morgendrot.directIotaSigner.tabEnc.v1']
    delete sessionStore['morgendrot.directIotaSigner.tabKey.v1']
    clearDirectIotaSessionSigner()
    expect(getDirectIotaSessionSignerAddress()).toBeNull()

    const restored = restoreDirectIotaSessionSignerFromTabSession()
    expect(restored.ok).toBe(true)
    if (restored.ok) expect(restored.address).toBe(applied.address)
    expect(getDirectIotaSessionSignerAddress()).not.toBeNull()
    await whenDirectIotaTabSessionPersistIdle()
  })

  it('clears persisted signer blob', async () => {
    const saved = await persistDirectIotaSessionSignerEncrypted({
      signerImportRaw: rawHexSecret,
      password: 'correct-pass-2026',
    })
    expect(saved.ok).toBe(true)
    expect(hasPersistedDirectIotaSessionSigner()).toBe(true)
    clearPersistedDirectIotaSessionSigner()
    expect(hasPersistedDirectIotaSessionSigner()).toBe(false)
  })
})
