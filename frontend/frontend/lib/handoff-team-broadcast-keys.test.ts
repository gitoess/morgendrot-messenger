import { describe, expect, it, vi } from 'vitest'
import { parseHandoffEncryptedBundle, serializeHandoffEncryptedBundle } from '@/frontend/lib/handoff-zip-bundle'
import {
  applyTeamBroadcastKeysFromExtras,
  collectTeamMailboxIdsFromHandoffEnv,
  enrichHandoffExtrasFromEnvContent,
} from '@/frontend/lib/handoff-team-broadcast-keys'
import { generateTeamBroadcastKeyRaw, teamBroadcastKeyToBase64 } from '@morgendrot/shared/morgendrot-team-broadcast-crypto'

const MB = '0x' + 'a'.repeat(64)

describe('handoff-team-broadcast-keys', () => {
  it('collectTeamMailboxIdsFromHandoffEnv sammelt MAILBOX + TEAM + Gruppe', () => {
    const env = {
      MAILBOX_ID: MB,
      TEAM_MAILBOX_IDS: '0x' + 'b'.repeat(64),
      MESSENGER_GROUP_HANDOFF: JSON.stringify({
        name: 'G1',
        teamMailboxObjectId: '0x' + 'c'.repeat(64),
        memberAddresses: ['0x' + 'd'.repeat(64)],
      }),
    }
    const ids = collectTeamMailboxIdsFromHandoffEnv(env)
    expect(ids).toHaveLength(3)
    expect(ids).toContain(MB)
  })

  it('enrichHandoffExtrasFromEnvContent fügt Team-Key ein', () => {
    const store: Record<string, string> = {}
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          delete store[k]
        },
      },
    } as Window & typeof globalThis)
    const raw = generateTeamBroadcastKeyRaw()
    store[`morgendrot.teamBroadcastKey.v1:${MB}`] = teamBroadcastKeyToBase64(raw)
    const env = `MAILBOX_ID=${MB}\nTEAM_MAILBOX_IDS=\n`
    const extras = enrichHandoffExtrasFromEnvContent(undefined, env)
    expect(extras.teamBroadcastKeys?.length).toBe(1)
    expect(extras.teamBroadcastKeys?.[0]?.teamMailboxObjectId).toBe(MB)
    vi.unstubAllGlobals()
  })

  it('applyTeamBroadcastKeysFromExtras schreibt Key in localStorage', () => {
    const store: Record<string, string> = {}
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          delete store[k]
        },
      },
    } as Window & typeof globalThis)
    const raw = generateTeamBroadcastKeyRaw()
    const n = applyTeamBroadcastKeysFromExtras({
      teamBroadcastKeys: [{ teamMailboxObjectId: MB, keyBase64: teamBroadcastKeyToBase64(raw), keyEpoch: 2 }],
    })
    expect(n).toBe(1)
    expect(store[`morgendrot.teamBroadcastKey.v1:${MB}`]).toBeTruthy()
    expect(store[`morgendrot.teamBroadcastKeyEpoch.v1:${MB}`]).toBe('2')
    vi.unstubAllGlobals()
  })
})

describe('handoff-zip-bundle', () => {
  it('roundtrip verschlüsseltes Bundle mit Extras', () => {
    const env = 'PACKAGE_ID=0x' + '1'.repeat(64)
    const extras = {
      teamBroadcastKeys: [{ teamMailboxObjectId: MB, keyBase64: 'abc', keyEpoch: 1 }],
    }
    const wire = serializeHandoffEncryptedBundle(env, extras)
    const parsed = parseHandoffEncryptedBundle(wire)
    expect(parsed.envText).toBe(env)
    expect(parsed.extras?.teamBroadcastKeys?.length).toBe(1)
  })

  it('legacy plain env bleibt envText', () => {
    const env = 'ROLE=arbeiter\n'
    expect(parseHandoffEncryptedBundle(env).envText).toBe(env)
  })
})
