import { describe, expect, it, vi } from 'vitest'
import { evaluateBossReadiness, isBossReady } from '@/frontend/lib/boss-readiness'

vi.mock('@/frontend/lib/messenger-session-keys-ready', () => ({
  isBrowserSessionSignerReady: () => true,
}))

vi.mock('@/frontend/lib/direct-iota-mnemonic-session', () => ({
  getDirectIotaSessionSignerAddress: () => '',
}))

vi.mock('@/frontend/lib/einsatz-network-profiles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/frontend/lib/einsatz-network-profiles')>()
  return {
    ...actual,
    readNetworkProfilesState: () => ({
      active: 'testnet',
      setupPlan: 'testnet-only',
      setupPlanChosen: true,
      testnet: { packageId: '0x' + 'a'.repeat(64), mailboxId: '', rpcUrl: 'https://api.testnet.iota.cafe' },
      mainnet: { packageId: '', mailboxId: '', rpcUrl: '' },
    }),
    syncProfilesFromApi: (state: unknown) => state,
  }
})

vi.mock('@/frontend/lib/my-private-mailbox-store', () => ({
  readMyPrivateMailboxes: () => [],
}))

vi.mock('@/frontend/lib/my-team-mailbox-store', () => ({
  readMyTeamMailboxes: () => [],
}))

const PKG = '0x' + 'a'.repeat(64)
const MB = '0x' + 'b'.repeat(64)
const ADDR = '0x' + 'c'.repeat(64)

describe('boss-readiness', () => {
  it('ready bei vollständigem Boss-Status', () => {
    const r = evaluateBossReadiness({
      api: {
        backendRunning: true,
        backendOnline: true,
        hasKeys: true,
        locked: false,
        packageId: PKG,
        mailboxId: MB,
        myAddressFull: ADDR,
        einsatzConfig: { editionLabel: 'x', defaultTtlDays: 30, enablePurge: true },
      },
    })
    expect(
      isBossReady({
        api: {
          backendRunning: true,
          backendOnline: true,
          hasKeys: true,
          locked: false,
          packageId: PKG,
          mailboxId: MB,
          myAddressFull: ADDR,
          einsatzConfig: { editionLabel: 'x', defaultTtlDays: 30, enablePurge: true },
        },
      })
    ).toBe(true)
    expect(r.ready).toBe(true)
    expect(r.minimalReady).toBe(true)
    expect(r.items.find((i) => i.id === 'core')?.status).toBe('ok')
  })

  it('fail ohne Package und Postfach', () => {
    const r = evaluateBossReadiness({
      api: {
        backendRunning: true,
        backendOnline: true,
        myAddressFull: ADDR,
      },
    })
    expect(r.ready).toBe(false)
    expect(r.items.find((i) => i.id === 'package')?.status).toBe('fail')
    expect(r.items.find((i) => i.id === 'mailbox-server')?.status).toBe('fail')
  })

  it('warn bei Server offline aus Cache', () => {
    const r = evaluateBossReadiness({
      api: {
        fromCache: true,
        backendOnline: false,
        packageId: PKG,
        mailboxId: MB,
        myAddressFull: ADDR,
      },
    })
    expect(r.items.find((i) => i.id === 'boss-online')?.status).toBe('warn')
  })
})
