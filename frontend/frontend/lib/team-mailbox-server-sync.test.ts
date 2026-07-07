import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import {
  diffTeamMailboxSync,
  mergeTeamMailboxIdLists,
  parseTeamMailboxIdsCsv,
  syncLocalTeamMailboxesToServer,
} from './team-mailbox-server-sync'
import * as dashboardRest from '@/frontend/lib/api/dashboard-rest'

const ID_A = `0x${'a'.repeat(64)}`
const ID_B = `0x${'b'.repeat(64)}`
const ID_PRIV = `0x${'c'.repeat(64)}`

describe('team-mailbox-server-sync', () => {
  const store: Record<string, string> = {}

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          delete store[k]
        },
      },
    } as Window & typeof globalThis)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parseTeamMailboxIdsCsv dedupliziert', () => {
    expect(parseTeamMailboxIdsCsv(`${ID_A}, ${ID_A}, ${ID_B}`)).toEqual([ID_A, ID_B])
  })

  it('mergeTeamMailboxIdLists vereinigt Listen', () => {
    expect(mergeTeamMailboxIdLists([ID_A], [ID_B, ID_A])).toEqual([ID_A, ID_B])
  })

  it('diffTeamMailboxSync erkennt fehlende Server-Union', () => {
    store['morgendrot.myTeamMailboxes.v1'] = JSON.stringify([{ objectId: ID_A, label: 'Team #1' }])
    const d = diffTeamMailboxSync({
      inboxUnionMailboxIds: [ID_PRIV],
      privateServerMailboxId: ID_PRIV,
    })
    expect(d.missingOnServer).toEqual([ID_A.toLowerCase()])
    expect(d.inSync).toBe(false)
  })

  it('diffTeamMailboxSync inSync wenn lokal in Union', () => {
    store['morgendrot.myTeamMailboxes.v1'] = JSON.stringify([{ objectId: ID_A }])
    const d = diffTeamMailboxSync({
      inboxUnionMailboxIds: [ID_PRIV, ID_A],
      privateServerMailboxId: ID_PRIV,
    })
    expect(d.inSync).toBe(true)
  })

  it('syncLocalTeamMailboxesToServer nutzt Backend auch ohne explizite API-Basis (Next-Proxy)', async () => {
    store['morgendrot.myTeamMailboxes.v1'] = JSON.stringify([{ objectId: ID_A, label: 'Team #1' }])
    vi.spyOn(dashboardRest, 'getConfig').mockResolvedValue({
      ok: true,
      config: [{ key: 'TEAM_MAILBOX_IDS', value: '', envKey: 'TEAM_MAILBOX_IDS' }],
    })
    vi.spyOn(dashboardRest, 'setConfig').mockResolvedValue({ ok: true, message: 'ok' })

    const r = await syncLocalTeamMailboxesToServer({ privateServerMailboxId: ID_PRIV })
    expect(r.ok).toBe(true)
    expect(r.message).toContain('Server übernommen')
    expect(dashboardRest.setConfig).toHaveBeenCalledWith('TEAM_MAILBOX_IDS', ID_A)
  })
})
