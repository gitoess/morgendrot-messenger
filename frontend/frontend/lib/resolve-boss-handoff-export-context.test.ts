import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/frontend/lib/direct-iota-mnemonic-session', () => ({
  getDirectIotaSessionSignerAddress: vi.fn(() => null),
}))

vi.mock('@/frontend/lib/direct-iota-rpc', () => ({
  getConfiguredDirectIotaRpcUrl: vi.fn(() => 'https://api.testnet.iota.cafe'),
}))

vi.mock('@/frontend/lib/einsatz-chain-mode-local', () => ({
  readPersistedEinsatzChainMode: vi.fn(() => 'mainnet-direct' as const),
}))

import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { resolveBossHandoffExportContext } from '@/frontend/lib/resolve-boss-handoff-export-context'

const PKG = '0x' + 'a'.repeat(64)
const MB = '0x' + 'c'.repeat(64)
const BOSS = '0x' + 'b'.repeat(64)

describe('resolveBossHandoffExportContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(getDirectIotaSessionSignerAddress).mockReturnValue(null)
  })

  it('ready when chain ids and sender in localStorage', () => {
    localStorage.setItem('morgendrot.directChain.packageId', PKG)
    localStorage.setItem('morgendrot.directChain.mailboxId', MB)
    localStorage.setItem('morgendrot.directChain.senderAddress', BOSS)
    localStorage.setItem('morgendrot.directChain.ttlDays', '21')

    const ctx = resolveBossHandoffExportContext()
    expect(ctx.ready).toBe(true)
    expect(ctx.packageId).toBe(PKG)
    expect(ctx.bossAddress).toBe(BOSS)
    expect(ctx.exportTtlDays).toBe(21)
  })

  it('prefers session signer over ls sender', () => {
    const sessionBoss = '0x' + 'd'.repeat(64)
    localStorage.setItem('morgendrot.directChain.packageId', PKG)
    localStorage.setItem('morgendrot.directChain.mailboxId', MB)
    localStorage.setItem('morgendrot.directChain.senderAddress', BOSS)
    vi.mocked(getDirectIotaSessionSignerAddress).mockReturnValue(sessionBoss)

    const ctx = resolveBossHandoffExportContext()
    expect(ctx.bossAddress).toBe(sessionBoss.toLowerCase())
  })

  it('not ready when package missing', () => {
    localStorage.setItem('morgendrot.directChain.mailboxId', MB)
    localStorage.setItem('morgendrot.directChain.senderAddress', BOSS)

    const ctx = resolveBossHandoffExportContext()
    expect(ctx.ready).toBe(false)
    expect(ctx.missing).toContain('Package-ID')
  })
})
