import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseHandoffEncryptedBundle, serializeHandoffEncryptedBundle } from '@/frontend/lib/handoff-zip-bundle'
import {
  applyTeamBroadcastKeysFromExtras,
  collectTeamMailboxIdsFromHandoffEnv,
  enrichHandoffExtrasFromEnvContent,
} from '@/frontend/lib/handoff-team-broadcast-keys'
import {
  purgeTeamBroadcastKeyVault,
  readTeamBroadcastKeyEpoch,
  readTeamBroadcastKeyRaw,
  writeTeamBroadcastKeyRaw,
} from '@/frontend/lib/team-broadcast-key-store'
import { generateTeamBroadcastKeyRaw, teamBroadcastKeyToBase64 } from '@morgendrot/shared/morgendrot-team-broadcast-crypto'

const MB = '0x' + 'a'.repeat(64)

function stubBrowserStorage(store: Record<string, string> = {}) {
  const session: Record<string, string> = {}
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
    sessionStorage: {
      getItem: (k: string) => session[k] ?? null,
      setItem: (k: string, v: string) => {
        session[k] = v
      },
      removeItem: (k: string) => {
        delete session[k]
      },
    },
  } as Window & typeof globalThis)
  return store
}

describe('handoff-team-broadcast-keys', () => {
  afterEach(() => {
    purgeTeamBroadcastKeyVault()
    vi.unstubAllGlobals()
  })

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
    stubBrowserStorage()
    const raw = generateTeamBroadcastKeyRaw()
    writeTeamBroadcastKeyRaw(MB, raw)
    const env = `MAILBOX_ID=${MB}\nTEAM_MAILBOX_IDS=\n`
    const extras = enrichHandoffExtrasFromEnvContent(undefined, env)
    expect(extras.teamBroadcastKeys?.length).toBe(1)
    expect(extras.teamBroadcastKeys?.[0]?.teamMailboxObjectId).toBe(MB)
  })

  it('applyTeamBroadcastKeysFromExtras schreibt Key in den Vault-Store (RAM)', () => {
    stubBrowserStorage()
    const raw = generateTeamBroadcastKeyRaw()
    const b64 = teamBroadcastKeyToBase64(raw)
    const n = applyTeamBroadcastKeysFromExtras({
      teamBroadcastKeys: [{ teamMailboxObjectId: MB, keyBase64: b64, keyEpoch: 2 }],
    })
    expect(n).toBe(1)
    expect(teamBroadcastKeyToBase64(readTeamBroadcastKeyRaw(MB)!)).toBe(b64)
    expect(readTeamBroadcastKeyEpoch(MB)).toBe(2)
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
