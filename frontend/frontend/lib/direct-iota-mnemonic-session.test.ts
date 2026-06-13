/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyDirectIotaMnemonicSession,
  clearDirectIotaSessionSigner,
  clearPersistedDirectIotaSessionSigner,
  getDirectIotaSessionSignerAddress,
  hasPersistedDirectIotaSessionSigner,
  persistDirectIotaSessionSignerEncrypted,
  restoreDirectIotaSessionSignerFromEncryptedStorage,
  restoreDirectIotaSessionSignerFromTabSession,
} from '@/frontend/lib/direct-iota-mnemonic-session'

describe('direct-iota-mnemonic-session encrypted local storage', () => {
  const store: Record<string, string> = {}
  const sessionStore: Record<string, string> = {}
  const rawHexSecret = '11'.repeat(32)

  beforeEach(() => {
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

  afterEach(() => {
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

  it('restores signer from tab session after RAM clear', () => {
    const applied = applyDirectIotaMnemonicSession(rawHexSecret)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    clearDirectIotaSessionSigner()
    expect(getDirectIotaSessionSignerAddress()).toBeNull()

    const restored = restoreDirectIotaSessionSignerFromTabSession()
    expect(restored.ok).toBe(true)
    if (restored.ok) expect(restored.address).toBe(applied.address)
    expect(getDirectIotaSessionSignerAddress()).not.toBeNull()
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
