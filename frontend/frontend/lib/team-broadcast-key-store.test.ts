import { afterEach, describe, expect, it } from 'vitest'
import {
  TEAM_BROADCAST_KEY_MISSING_MSG,
  createTeamBroadcastKey,
  exportTeamBroadcastKeysSnapshot,
  hasTeamBroadcastKey,
  hydrateTeamBroadcastKeysFromArchiveSidecar,
  importTeamBroadcastKeysSnapshot,
  requireTeamBroadcastKey,
  writeTeamBroadcastKeyRaw,
} from '@/frontend/lib/team-broadcast-key-store'
import { generateTeamBroadcastKeyRaw } from '@morgendrot/shared/morgendrot-team-broadcast-crypto'

const MB = `0x${'ab'.repeat(32)}`

describe('team-broadcast-key-store (H.23 B1)', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('requireTeamBroadcastKey wirft ohne Key (kein Auto-Fork)', () => {
    expect(() => requireTeamBroadcastKey(MB)).toThrow(TEAM_BROADCAST_KEY_MISSING_MSG)
  })

  it('createTeamBroadcastKey legt einmal an, erneut ohne rotate bleibt gleich', () => {
    const a = createTeamBroadcastKey(MB)
    expect(a.ok && a.created).toBe(true)
    expect(hasTeamBroadcastKey(MB)).toBe(true)
    const b = createTeamBroadcastKey(MB)
    expect(b.ok && b.created).toBe(false)
    expect(b.ok && b.epoch).toBe(1)
  })

  it('rotate erhöht Epoch', () => {
    createTeamBroadcastKey(MB)
    const r = createTeamBroadcastKey(MB, { rotate: true })
    expect(r.ok && r.rotated).toBe(true)
    expect(r.ok && r.epoch).toBe(2)
  })

  it('snapshot roundtrip', () => {
    writeTeamBroadcastKeyRaw(MB, generateTeamBroadcastKeyRaw())
    const snap = exportTeamBroadcastKeysSnapshot([MB])
    window.localStorage.clear()
    expect(hasTeamBroadcastKey(MB)).toBe(false)
    expect(importTeamBroadcastKeysSnapshot(snap)).toBe(1)
    expect(hasTeamBroadcastKey(MB)).toBe(true)
  })

  it('Archiv-Sidecar hydratisiert nach Clear der Einzelkeys', () => {
    createTeamBroadcastKey(MB)
    expect(window.localStorage.getItem('morgendrot.teamKeysArchive.v1')).toBeTruthy()
    window.localStorage.removeItem(`morgendrot.teamBroadcastKey.v1:${MB}`)
    expect(hasTeamBroadcastKey(MB)).toBe(false)
    expect(hydrateTeamBroadcastKeysFromArchiveSidecar()).toBeGreaterThanOrEqual(1)
    expect(hasTeamBroadcastKey(MB)).toBe(true)
  })
})
