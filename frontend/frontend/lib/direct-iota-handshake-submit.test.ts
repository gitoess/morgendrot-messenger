import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { canTryDirectHandshakeSubmit } from './direct-iota-handshake-submit'

vi.mock('@/frontend/lib/direct-iota-plain-submit', () => ({
  isIotaRelayOnlyMode: () => false,
  isDirectMailboxDrainEnabled: () => true,
}))

vi.mock('@/frontend/lib/direct-iota-rpc', () => ({
  getConfiguredDirectIotaRpcUrl: () => 'https://rpc.example',
}))

vi.mock('@/frontend/lib/direct-iota-mnemonic-session', () => ({
  getDirectIotaSessionSigner: () => ({}),
  getDirectIotaSessionSignerAddress: () => '0x' + '33'.repeat(32),
}))

vi.mock('@/frontend/lib/direct-iota-chain-context', () => ({
  canUseDirectEncryptedMailboxDrain: () => true,
  getDirectMailboxChainSnapshot: () => ({
    packageId: '0x' + '11'.repeat(32),
    mailboxId: '0x' + '22'.repeat(32),
    senderAddress: '0x' + '33'.repeat(32),
    ttlDays: 30n,
    flags: { useMailbox: true, mailboxStorePlaintext: true, messengerCreditsConfigured: false },
  }),
}))

describe('direct-iota-handshake-submit', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => {} } } as unknown as Window & typeof globalThis)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('canTryDirectHandshakeSubmit', () => {
    expect(canTryDirectHandshakeSubmit()).toBe(true)
  })
})
