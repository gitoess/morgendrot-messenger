import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { canFetchHandshakesViaDirectIota, tryFetchHandshakeOffersViaDirectIota } from './direct-iota-handshake-fetch'

vi.mock('@/frontend/lib/direct-iota-plain-submit', () => ({
  isIotaRelayOnlyMode: () => false,
}))

vi.mock('@/frontend/lib/direct-iota-rpc', () => ({
  getConfiguredDirectIotaRpcUrl: () => 'https://rpc.example',
}))

vi.mock('@/frontend/lib/direct-iota-chain-context', () => ({
  getDirectMailboxChainSnapshot: () => ({
    packageId: '0x' + '11'.repeat(32),
    senderAddress: '0x' + '33'.repeat(32),
  }),
}))

vi.mock('@/frontend/lib/pending-handshake-mailbox-ids', () => ({
  readClientMailboxIdsForHandshakeScan: () => [],
}))

const { listIncoming, listOutgoing } = vi.hoisted(() => ({
  listIncoming: vi.fn(async () => [
    { sender: '0x' + 'aa'.repeat(32), nonce: '7', source: 'event' as const },
  ]),
  listOutgoing: vi.fn(async () => []),
}))

vi.mock('@morgendrot/core/iota', () => ({
  createDirectIotaClient: () => ({}),
  listIncomingHandshakeOffersRpc: listIncoming,
  listOutgoingHandshakeOffersRpc: listOutgoing,
}))

describe('canFetchHandshakesViaDirectIota', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => {} } } as unknown as Window & typeof globalThis)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })
  it('true wenn RPC + Snapshot', () => {
    expect(canFetchHandshakesViaDirectIota()).toBe(true)
  })
})

describe('tryFetchHandshakeOffersViaDirectIota ohne lokale Mailbox', () => {
  beforeEach(() => {
    listIncoming.mockClear()
    listOutgoing.mockClear()
  })

  it('scannt EcdhInit auch ohne Mailbox-IDs (Consumer Event-Handshake)', async () => {
    const r = await tryFetchHandshakeOffersViaDirectIota()
    expect(r?.ok).toBe(true)
    expect(r?.offers).toHaveLength(1)
    expect(r?.offers?.[0]?.source).toBe('event')
    expect(listIncoming).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mailboxObjectIds: [] })
    )
  })
})
