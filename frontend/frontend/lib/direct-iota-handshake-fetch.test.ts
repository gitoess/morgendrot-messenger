import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { canFetchHandshakesViaDirectIota } from './direct-iota-handshake-fetch'

vi.mock('@/frontend/lib/direct-iota-plain-submit', () => ({
  isIotaRelayOnlyMode: () => false,
}))

vi.mock('@/frontend/lib/direct-iota-rpc', () => ({
  getConfiguredDirectIotaRpcUrl: () => 'https://rpc.example',
}))

vi.mock('@/frontend/lib/direct-iota-chain-context', () => ({
  getDirectMailboxChainSnapshot: () => ({
    packageId: '0x' + '11'.repeat(32),
    mailboxId: '0x' + '22'.repeat(32),
    senderAddress: '0x' + '33'.repeat(32),
  }),
}))

describe('direct-iota-handshake-fetch', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => {} } } as unknown as Window & typeof globalThis)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('canFetchHandshakesViaDirectIota wenn RPC + Snapshot', () => {
    expect(canFetchHandshakesViaDirectIota()).toBe(true)
  })
})
