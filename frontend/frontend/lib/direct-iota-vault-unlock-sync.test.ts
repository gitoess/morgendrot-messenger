/**
 * @vitest-environment node
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyDirectIotaMnemonicSession,
  clearDirectIotaSessionSigner,
  clearPersistedDirectIotaSessionSigner,
  disableDirectIotaTabSessionPersistForVitest,
  drainDirectIotaTabSessionPersistForTests,
  enableDirectIotaTabSessionPersistForVitest,
  getDirectIotaSessionSignerAddress,
  persistDirectIotaSessionSignerEncrypted,
  resetDirectIotaMnemonicSessionModuleForTests,
  whenDirectIotaTabSessionPersistIdle,
} from '@/frontend/lib/direct-iota-mnemonic-session'
import {
  syncDirectChatEcdhAfterVaultUnlock,
  syncDirectIotaSessionSignerAfterVaultUnlock,
  tryAutoRestoreDirectIotaSessionSignerAsync,
} from '@/frontend/lib/direct-iota-vault-unlock-sync'

vi.mock('@/frontend/lib/api/vault-signer-import', () => ({
  revealVaultSignerImport: vi.fn(),
}))

vi.mock('@/frontend/lib/api/vault-ecdh-jwk', () => ({
  fetchSessionEcdhPrivateJwk: vi.fn(),
  revealVaultEcdhPrivateJwk: vi.fn(),
}))

vi.mock('@/frontend/lib/direct-chat-ecdh-session', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/frontend/lib/direct-chat-ecdh-session')>()
  return {
    ...mod,
    getDirectChatEcdhPrivateKey: vi.fn(() => mod.getDirectChatEcdhPrivateKey()),
    restoreDirectChatEcdhPrivateFromLocalStorage: vi.fn(async () => mod.restoreDirectChatEcdhPrivateFromLocalStorage()),
    applyDirectChatEcdhPrivateJwk: vi.fn(async (j: string) => mod.applyDirectChatEcdhPrivateJwk(j)),
  }
})

vi.mock('@/frontend/lib/active-network-chain-sync', () => ({
  syncActiveNetworkChainSnapshot: vi.fn(),
}))

vi.mock('@/frontend/lib/direct-iota-ui-events', () => ({
  notifyDirectIotaUiChanged: vi.fn(),
}))

import { revealVaultSignerImport } from '@/frontend/lib/api/vault-signer-import'
import { fetchSessionEcdhPrivateJwk, revealVaultEcdhPrivateJwk } from '@/frontend/lib/api/vault-ecdh-jwk'
import { clearDirectChatEcdhPrivateKey } from '@/frontend/lib/direct-chat-ecdh-session'

describe('syncDirectIotaSessionSignerAfterVaultUnlock', () => {
  const rawHexSecret = '11'.repeat(32)
  const sessionStore: Record<string, string> = {}
  const store: Record<string, string> = {}

  beforeEach(async () => {
    await drainDirectIotaTabSessionPersistForTests()
    resetDirectIotaMnemonicSessionModuleForTests()
    enableDirectIotaTabSessionPersistForVitest()
    Object.keys(sessionStore).forEach((k) => delete sessionStore[k])
    Object.keys(store).forEach((k) => delete store[k])
    clearDirectIotaSessionSigner()
    clearPersistedDirectIotaSessionSigner()
    vi.mocked(revealVaultSignerImport).mockReset()
    vi.mocked(fetchSessionEcdhPrivateJwk).mockReset()
    vi.mocked(revealVaultEcdhPrivateJwk).mockReset()
    clearDirectChatEcdhPrivateKey()
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
    resetDirectIotaMnemonicSessionModuleForTests()
    vi.unstubAllGlobals()
    clearDirectIotaSessionSigner()
    clearPersistedDirectIotaSessionSigner()
  })

  it('returns existing session without vault call', async () => {
    const applied = applyDirectIotaMnemonicSession(rawHexSecret)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return

    const r = await syncDirectIotaSessionSignerAfterVaultUnlock({
      vaultPassword: 'vault-pass',
      signerMode: 'sdk',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.source).toBe('session')
      expect(r.address).toBe(applied.address)
    }
    expect(revealVaultSignerImport).not.toHaveBeenCalled()
  })

  it('applies signerImport from unlock form', async () => {
    const applied = applyDirectIotaMnemonicSession(rawHexSecret)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    clearDirectIotaSessionSigner()

    const r = await syncDirectIotaSessionSignerAfterVaultUnlock({
      vaultPassword: 'vault-pass-2026',
      signerMode: 'sdk',
      signerImport: rawHexSecret,
      expectedAddress: applied.address,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.source).toBe('import')
    expect(getDirectIotaSessionSignerAddress()).not.toBeNull()
    expect(revealVaultSignerImport).not.toHaveBeenCalled()
  })

  it('reveals signer from vault when SIGNER=sdk', async () => {
    vi.mocked(revealVaultSignerImport).mockResolvedValue({
      ok: true,
      signerImport: rawHexSecret,
    })

    const applied = applyDirectIotaMnemonicSession(rawHexSecret)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    clearDirectIotaSessionSigner()
    const masked = `${applied.address.slice(0, 10)}…${applied.address.slice(-6)}`

    const r = await syncDirectIotaSessionSignerAfterVaultUnlock({
      vaultPassword: 'vault-pass',
      signerMode: 'sdk',
      expectedAddress: masked,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.source).toBe('vault')
    expect(revealVaultSignerImport).toHaveBeenCalledWith('vault-pass')
  })

  it('skips vault when SIGNER is not sdk', async () => {
    const r = await syncDirectIotaSessionSignerAfterVaultUnlock({
      vaultPassword: 'vault-pass',
      signerMode: 'local',
    })
    expect(r.ok).toBe(false)
    expect(revealVaultSignerImport).not.toHaveBeenCalled()
  })

  it('tab session restore after RAM clear', async () => {
    const applied = applyDirectIotaMnemonicSession(rawHexSecret)
    expect(applied.ok).toBe(true)
    await whenDirectIotaTabSessionPersistIdle()
    clearDirectIotaSessionSigner()
    const auto = await tryAutoRestoreDirectIotaSessionSignerAsync()
    expect(auto.ok).toBe(true)
    if (auto.ok) expect(auto.source).toBe('tab')
  })

  it('rejects persisted signer when expectedAddress mismatches', async () => {
    const applied = applyDirectIotaMnemonicSession(rawHexSecret)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    await persistDirectIotaSessionSignerEncrypted({
      signerImportRaw: rawHexSecret,
      password: 'vault-pass-2026',
    })
    clearDirectIotaSessionSigner()
    const wrong = '0x' + 'ff'.repeat(32)

    const r = await syncDirectIotaSessionSignerAfterVaultUnlock({
      vaultPassword: 'vault-pass-2026',
      signerMode: 'sdk',
      expectedAddress: wrong,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('MY_ADDRESS')
    expect(getDirectIotaSessionSignerAddress()).toBeNull()
  })
})

describe('syncDirectChatEcdhAfterVaultUnlock', () => {
  let validJwk: string

  beforeAll(async () => {
    const pair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits', 'deriveKey']
    )
    validJwk = JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey))
  })

  beforeEach(() => {
    clearDirectChatEcdhPrivateKey()
    vi.mocked(fetchSessionEcdhPrivateJwk).mockReset()
    vi.mocked(revealVaultEcdhPrivateJwk).mockReset()
    vi.stubGlobal(
      'window',
      {
        localStorage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
          clear: () => {},
          key: () => null,
          length: 0,
        } as Storage,
      } as Window & typeof globalThis
    )
  })

  afterEach(async () => {
    await drainDirectIotaTabSessionPersistForTests()
    clearDirectChatEcdhPrivateKey()
    vi.unstubAllGlobals()
  })

  it('lädt JWK aus entsperrter Boss-Sitzung', async () => {
    vi.mocked(fetchSessionEcdhPrivateJwk).mockResolvedValue({
      ok: true,
      ecdhPrivateJwk: validJwk,
    })

    const r = await syncDirectChatEcdhAfterVaultUnlock({ vaultPassword: 'vault-pass' })
    expect(r.ok).toBe(true)
    expect(fetchSessionEcdhPrivateJwk).toHaveBeenCalled()
    expect(revealVaultEcdhPrivateJwk).not.toHaveBeenCalled()
  })

  it('fallback auf Vault-Datei mit Passwort', async () => {
    vi.mocked(fetchSessionEcdhPrivateJwk).mockResolvedValue({ ok: false, error: 'locked' })
    vi.mocked(revealVaultEcdhPrivateJwk).mockResolvedValue({
      ok: true,
      ecdhPrivateJwk: validJwk,
    })

    const r = await syncDirectChatEcdhAfterVaultUnlock({ vaultPassword: 'vault-pass' })
    expect(r.ok).toBe(true)
    expect(revealVaultEcdhPrivateJwk).toHaveBeenCalledWith('vault-pass')
  })
})
