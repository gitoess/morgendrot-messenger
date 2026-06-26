import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { applyHandoffEnvToLocalDevice } from './handoff-device-bootstrap'

describe('handoff-device-bootstrap', () => {
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

  it('speichert Handoff, RPC und Ketten-IDs lokal', () => {
    const pkg = '0x' + 'a'.repeat(64)
    const mb = '0x' + 'b'.repeat(64)
    const addr = '0x' + 'c'.repeat(64)
    const env = [
      '# Einsatz-Bezeichnung: Team Alpha',
      `PACKAGE_ID=${pkg}`,
      `MAILBOX_ID=${mb}`,
      `MY_ADDRESS=${addr}`,
      'USE_MAILBOX=true',
      'MAILBOX_STORE_PLAINTEXT=true',
      'NEXT_PUBLIC_DIRECT_IOTA_RPC_URL=https://fullnode.testnet.example',
      'ROLE=arbeiter',
      'TRANSPORT_PROFILE=mesh-first',
    ].join('\n')

    const snap = applyHandoffEnvToLocalDevice(env)
    expect(snap.handoffLabel).toBe('Team Alpha')
    expect(snap.packageId).toBe(pkg)
    expect(store['morgendrot.directIotaRpcUrl']).toBe('https://fullnode.testnet.example')
    expect(store['morgendrot.directChain.packageId']).toBe(pkg)
    expect(store['morgendrot.directChain.mailboxId']).toBe(mb)
    expect(store['morgendrot.directChain.senderAddress']).toBe(addr)
    expect(store['morgendrot.iotaSubmitMode']).toBeUndefined()
    expect(store['morgendrot.directMailboxDrain']).toBe('1')
    expect(store['morgendrot.directChain.optimisticFlags']).toBe('1')
  })

  it('importiert TEAM_MAILBOX_IDS in Team-Store', () => {
    const teamA = '0x' + 'd'.repeat(64)
    const teamB = '0x' + 'e'.repeat(64)
    const env = [
      `TEAM_MAILBOX_IDS=${teamA},${teamB}`,
      'HANDOFF_LABEL=THW Alpha',
      'PACKAGE_ID=0x' + 'a'.repeat(64),
      'MAILBOX_ID=0x' + 'b'.repeat(64),
    ].join('\n')
    applyHandoffEnvToLocalDevice(env)
    const raw = store['morgendrot.myTeamMailboxes.v1']
    expect(raw).toBeTruthy()
    const list = JSON.parse(raw!) as { objectId: string }[]
    const ids = list.map((e) => e.objectId.toLowerCase()).sort()
    expect(ids).toEqual([teamA, teamB].map((x) => x.toLowerCase()).sort())
  })
})
