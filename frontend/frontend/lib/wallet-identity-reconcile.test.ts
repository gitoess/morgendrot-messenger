import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/frontend/lib/direct-iota-mnemonic-session', () => ({
  getDirectIotaSessionSignerAddress: vi.fn(),
  clearDirectIotaSessionSigner: vi.fn(),
  clearDirectIotaSessionSignerTabSession: vi.fn(),
}))

vi.mock('@/frontend/lib/direct-iota-chain-context', () => ({
  getDirectChainFieldIdsFromLs: vi.fn(() => ({ senderAddress: '' })),
}))

vi.mock('@/frontend/lib/active-network-chain-sync', () => ({
  syncActiveNetworkChainSnapshot: vi.fn(),
}))

import {
  clearDirectIotaSessionSigner,
  clearDirectIotaSessionSignerTabSession,
  getDirectIotaSessionSignerAddress,
} from '@/frontend/lib/direct-iota-mnemonic-session'
import { getDirectChainFieldIdsFromLs } from '@/frontend/lib/direct-iota-chain-context'
import { syncActiveNetworkChainSnapshot } from '@/frontend/lib/active-network-chain-sync'
import { reconcileWalletIdentityWithServer } from '@/frontend/lib/wallet-identity-reconcile'

const BOSS = `0x${'b'.repeat(64)}`
const HELPER = `0x${'c'.repeat(64)}`

describe('reconcileWalletIdentityWithServer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getDirectIotaSessionSignerAddress).mockReturnValue(null)
    vi.mocked(getDirectChainFieldIdsFromLs).mockReturnValue({
      senderAddress: '',
      packageId: '',
      mailboxId: '',
      ttlDays: 30n,
    } as never)
  })

  it('löscht Browser-Signer wenn er nicht zur Server-Adresse passt', () => {
    vi.mocked(getDirectIotaSessionSignerAddress).mockReturnValue(HELPER)
    const r = reconcileWalletIdentityWithServer(BOSS)
    expect(r.clearedBrowserSigner).toBe(true)
    expect(clearDirectIotaSessionSigner).toHaveBeenCalled()
    expect(clearDirectIotaSessionSignerTabSession).toHaveBeenCalled()
  })

  it('gleicht LS-Sender an Server an', () => {
    vi.mocked(getDirectChainFieldIdsFromLs).mockReturnValue({
      senderAddress: HELPER,
      packageId: '',
      mailboxId: '',
      ttlDays: 30n,
    } as never)
    const r = reconcileWalletIdentityWithServer(BOSS)
    expect(r.updatedChainSender).toBe(true)
    expect(syncActiveNetworkChainSnapshot).toHaveBeenCalledWith(BOSS)
  })
})
