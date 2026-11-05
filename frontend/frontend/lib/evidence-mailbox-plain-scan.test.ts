import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/frontend/lib/direct-iota-rpc', () => ({
  getConfiguredDirectIotaRpcUrl: vi.fn(() => null),
}))

vi.mock('@/frontend/lib/direct-iota-chain-context', () => ({
  getDirectMailboxChainSnapshot: vi.fn(() => null),
}))

import { scanMailboxPlaintextForAddress } from '@/frontend/lib/evidence-mailbox-plain-scan'

describe('scanMailboxPlaintextForAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ohne RPC → Fehler', async () => {
    const r = await scanMailboxPlaintextForAddress({
      mailboxObjectId: `0x${'11'.repeat(32)}`,
      packageId: `0x${'22'.repeat(32)}`,
      address: `0x${'33'.repeat(32)}`,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/RPC/i)
  })
})
