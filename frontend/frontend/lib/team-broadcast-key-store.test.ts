import { afterEach, describe, expect, it } from 'vitest'
import {
  TEAM_BROADCAST_KEY_MISSING_MSG,
  TEAM_KEYS_ENC_LS_KEY,
  createTeamBroadcastKey,
  exportTeamBroadcastKeysSnapshot,
  flushTeamBroadcastKeyVaultPersist,
  hasEncryptedTeamKeysVault,
  hasTeamBroadcastKey,
  hydrateTeamBroadcastKeysFromArchiveSidecar,
  importTeamBroadcastKeysSnapshot,
  lockTeamBroadcastKeyVault,
  purgeTeamBroadcastKeyVault,
  requireTeamBroadcastKey,
  unlockTeamBroadcastKeyVault,
  writeTeamBroadcastKeyRaw,
} from '@/frontend/lib/team-broadcast-key-store'
import {
  generateTeamBroadcastKeyRaw,
  teamBroadcastKeyToBase64,
} from '@morgendrot/shared/morgendrot-team-broadcast-crypto'
import { setVaultPasswordSession } from '@/frontend/lib/vault-password-session'

const MB = `0x${'ab'.repeat(32)}`

describe('team-broadcast-key-store (H.23 B1)', () => {
  afterEach(() => {
    purgeTeamBroadcastKeyVault()
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('requireTeamBroadcastKey wirft ohne Key (kein Auto-Fork)', () => {
    expect(() => requireTeamBroadcastKey(MB)).toThrow(TEAM_BROADCAST_KEY_MISSING_MSG)
  })

  it('createTeamBroadcastKey ohne Vault-Session abgelehnt', () => {
    const r = createTeamBroadcastKey(MB)
    expect(r.ok).toBe(false)
  })

  it('createTeamBroadcastKey legt einmal an, erneut ohne rotate bleibt gleich', () => {
    setVaultPasswordSession('vault-pass-99')
    const a = createTeamBroadcastKey(MB)
    expect(a.ok && a.created).toBe(true)
    expect(hasTeamBroadcastKey(MB)).toBe(true)
    const b = createTeamBroadcastKey(MB)
    expect(b.ok && b.created).toBe(false)
    expect(b.ok && b.epoch).toBe(1)
  })

  it('rotate erhöht Epoch', () => {
    setVaultPasswordSession('vault-pass-99')
    createTeamBroadcastKey(MB)
    const r = createTeamBroadcastKey(MB, { rotate: true })
    expect(r.ok && r.rotated).toBe(true)
    expect(r.ok && r.epoch).toBe(2)
  })

  it('snapshot roundtrip', () => {
    writeTeamBroadcastKeyRaw(MB, generateTeamBroadcastKeyRaw())
    const snap = exportTeamBroadcastKeysSnapshot([MB])
    purgeTeamBroadcastKeyVault()
    expect(hasTeamBroadcastKey(MB)).toBe(false)
    expect(importTeamBroadcastKeysSnapshot(snap)).toBe(1)
    expect(hasTeamBroadcastKey(MB)).toBe(true)
  })

  it('vault-enc Sidecar überlebt Lock+Unlock; Legacy-Archiv hydratisiert', async () => {
    setVaultPasswordSession('vault-pass-99')
    await unlockTeamBroadcastKeyVault('vault-pass-99')
    createTeamBroadcastKey(MB)
    await flushTeamBroadcastKeyVaultPersist()
    expect(hasEncryptedTeamKeysVault()).toBe(true)
    expect(window.localStorage.getItem(TEAM_KEYS_ENC_LS_KEY)).toContain('morgendrot.team-keys.enc.v1')
    expect(window.localStorage.getItem(`morgendrot.teamBroadcastKey.v1:${MB}`)).toBeNull()

    lockTeamBroadcastKeyVault()
    expect(hasTeamBroadcastKey(MB)).toBe(false)

    setVaultPasswordSession('vault-pass-99')
    const again = await unlockTeamBroadcastKeyVault('vault-pass-99')
    expect(again.ok).toBe(true)
    expect(hasTeamBroadcastKey(MB)).toBe(true)
  })

  it('Legacy-Archiv wird ohne Vault-Session nicht in RAM geladen', () => {
    const raw = generateTeamBroadcastKeyRaw()
    window.localStorage.setItem(
      'morgendrot.teamKeysArchive.v1',
      JSON.stringify({
        schema: 1,
        keys: { [MB]: { keyBase64: teamBroadcastKeyToBase64(raw), keyEpoch: 1 } },
      })
    )
    expect(hydrateTeamBroadcastKeysFromArchiveSidecar()).toBe(0)
    expect(hasTeamBroadcastKey(MB)).toBe(false)
  })

  it('Lock entfernt Tab-Backup (kein Klartext nach Sperre)', async () => {
    setVaultPasswordSession('vault-pass-99')
    await unlockTeamBroadcastKeyVault('vault-pass-99')
    createTeamBroadcastKey(MB)
    expect(window.sessionStorage.getItem('morgendrot.teamKeys.tab.v1')).toBeTruthy()
    lockTeamBroadcastKeyVault()
    expect(window.sessionStorage.getItem('morgendrot.teamKeys.tab.v1')).toBeNull()
    expect(hasTeamBroadcastKey(MB)).toBe(false)
  })
})

