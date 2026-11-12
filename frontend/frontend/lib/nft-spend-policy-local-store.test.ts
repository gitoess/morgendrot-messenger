import { beforeEach, describe, expect, it, vi } from 'vitest'

const NFT = ('0x' + '22'.repeat(32)).toLowerCase()

describe('nft-spend-policy-local-store', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  it('mintModeAttrs und sync aus Attrs', async () => {
    const mod = await import('@/frontend/lib/nft-spend-policy-local-store')
    expect(mod.mintModeAttrs({ oneTimeUse: true, offlineHandoff: true })).toEqual([
      { key: 'spend_policy', value: 'one_time' },
      { key: 'offline_handoff', value: '1' },
    ])
    const synced = mod.syncNftSpendPolicyFromAttrs(NFT, [
      { key: 'spend_policy', value: 'one_time' },
      { key: 'offline_handoff', value: '1' },
    ])
    expect(synced?.oneTimeUse).toBe(true)
    expect(synced?.offlineHandoff).toBe(true)
    expect(synced?.burnAfterSpend).toBe(true)
  })

  it('blockiert nach consume', async () => {
    const mod = await import('@/frontend/lib/nft-spend-policy-local-store')
    mod.upsertNftSpendPolicy({ nftObjectId: NFT, oneTimeUse: true, burnAfterSpend: false })
    expect(mod.assertNftSpendCapabilityUsable(NFT).ok).toBe(true)
    mod.markNftSpendCapabilityConsumed({ nftObjectId: NFT, digest: 'abc' })
    const gate = mod.assertNftSpendCapabilityUsable(NFT)
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.error).toMatch(/verbraucht/)
  })

  it('shouldBurnNftAfterSpend nur bei One-Time+Burn', async () => {
    const mod = await import('@/frontend/lib/nft-spend-policy-local-store')
    expect(mod.shouldBurnNftAfterSpend(NFT)).toBe(false)
    mod.upsertNftSpendPolicy({ nftObjectId: NFT, oneTimeUse: true, burnAfterSpend: true })
    expect(mod.shouldBurnNftAfterSpend(NFT)).toBe(true)
    mod.upsertNftSpendPolicy({ nftObjectId: NFT, oneTimeUse: true, burnAfterSpend: false })
    expect(mod.shouldBurnNftAfterSpend(NFT)).toBe(false)
  })

  it('finalize markiert Burn schon erledigt in Spend-TX', async () => {
    const mod = await import('@/frontend/lib/nft-spend-policy-local-store')
    mod.upsertNftSpendPolicy({ nftObjectId: NFT, oneTimeUse: true, burnAfterSpend: true })
    const r = await mod.finalizeOneTimeNftAfterSuccessfulSpend({
      nftObjectId: NFT,
      spendDigest: 'digestSpendBurn',
      burnAlreadyDone: true,
    })
    expect(r.consumed).toBe(true)
    expect(r.burned).toBe(true)
    expect(r.burnDigest).toBe('digestSpendBurn')
    expect(mod.getNftSpendPolicy(NFT)?.consumedAtMs).toBeTruthy()
  })

  it('badgeParts aus Policy und Attrs', async () => {
    const mod = await import('@/frontend/lib/nft-spend-policy-local-store')
    expect(
      mod.nftSpendPolicyBadgeParts(NFT, [
        { key: 'spend_policy', value: 'one_time' },
        { key: 'offline_handoff', value: '1' },
      ])
    ).toEqual(['One-Time', 'Offline-Index'])
    mod.upsertNftSpendPolicy({ nftObjectId: NFT, oneTimeUse: true, offlineHandoff: true })
    mod.markNftSpendCapabilityConsumed({ nftObjectId: NFT })
    expect(mod.nftSpendPolicyBadgeParts(NFT)).toContain('One-Time · verbraucht')
  })
})
