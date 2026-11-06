import { afterEach, describe, expect, it } from 'vitest'
import { createRatchetSessionPair } from '@morgendrot/shared/morgendrot-ratchet-session'
import {
  flushRatchetSessionVaultPersist,
  getRatchetSessionForPeer,
  lockRatchetSessionVault,
  purgeRatchetSessionVault,
  putRatchetSessionForPeer,
  unlockRatchetSessionVault,
} from '@/frontend/lib/ratchet-session-local-store'
import { clearVaultPasswordSession, setVaultPasswordSession } from '@/frontend/lib/vault-password-session'

const ALICE = `0x${'aa'.repeat(32)}`
const BOB = `0x${'bb'.repeat(32)}`
const VAULT = 'vault-pass-99'

describe('ratchet-session-local-store C1.4', () => {
  afterEach(() => {
    purgeRatchetSessionVault()
    clearVaultPasswordSession()
    window.localStorage.clear()
  })

  it('persistiert Symmetric-Session über Lock/Unlock', async () => {
    setVaultPasswordSession(VAULT)
    const shared = crypto.getRandomValues(new Uint8Array(32))
    const { alice, bob } = await createRatchetSessionPair(shared, ALICE, BOB)
    const p = await alice.encrypt('geheim', 'm1')
    putRatchetSessionForPeer(BOB, alice)
    await flushRatchetSessionVaultPersist()

    lockRatchetSessionVault()
    expect(getRatchetSessionForPeer(BOB)).toBeNull()

    const unlocked = await unlockRatchetSessionVault(VAULT)
    expect(unlocked.ok).toBe(true)
    expect(unlocked.count).toBe(1)

    const restored = getRatchetSessionForPeer(BOB)
    expect(restored).not.toBeNull()
    // Bob kann die vor dem Persist gesendete Msg noch entschlüsseln (seine Chain unverändert).
    expect(await bob.decrypt(p)).toBe('geheim')
    // Restored Alice sendet weiter; Bob empfängt.
    const p2 = await restored!.encrypt('nach unlock', 'm2')
    expect(await bob.decrypt(p2)).toBe('nach unlock')
  })

  it('Purge entfernt Sidecar', async () => {
    setVaultPasswordSession(VAULT)
    const shared = crypto.getRandomValues(new Uint8Array(32))
    const { alice } = await createRatchetSessionPair(shared, ALICE, BOB)
    putRatchetSessionForPeer(BOB, alice)
    await flushRatchetSessionVaultPersist()
    expect(window.localStorage.getItem('morgendrot.ratchet.enc.v1')).toBeTruthy()
    purgeRatchetSessionVault()
    expect(window.localStorage.getItem('morgendrot.ratchet.enc.v1')).toBeNull()
  })
})
