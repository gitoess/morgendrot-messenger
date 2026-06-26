import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  applyBossPackageId,
  deployBossMovePackage,
  ensureBossRoleOnServer,
} from '@/frontend/lib/onboarding-boss-bootstrap'

vi.mock('@/frontend/lib/api/api-base', () => ({
  getApiBase: () => 'http://127.0.0.1:3342',
}))

vi.mock('@/frontend/lib/api/dashboard-rest', () => ({
  setConfig: vi.fn(async () => ({ ok: true })),
}))

vi.mock('@/frontend/lib/api/package-connect', () => ({
  setPackageIdCommand: vi.fn(async () => ({ ok: true })),
}))

describe('onboarding-boss-bootstrap', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        json: async () => ({ ok: true, packageId: '0x' + 'a'.repeat(64), message: 'ok' }),
      }))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('ensureBossRoleOnServer setzt ROLE', async () => {
    const { setConfig } = await import('@/frontend/lib/api/dashboard-rest')
    const r = await ensureBossRoleOnServer()
    expect(r.ok).toBe(true)
    expect(setConfig).toHaveBeenCalledWith('ROLE', 'boss')
  })

  it('deployBossMovePackage ruft API auf', async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ ok: true, packageId: '0x' + 'a'.repeat(64), message: 'ok' }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const r = await deployBossMovePackage({ createGlobals: true })
    expect(r.ok).toBe(true)
    expect(r.packageId).toMatch(/^0x[a-f]{64}$/i)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/deploy-package'),
      expect.objectContaining({
        body: JSON.stringify({ createGlobals: true, forceGlobals: false }),
      })
    )
  })

  it('applyBossPackageId validiert Hex', async () => {
    const bad = await applyBossPackageId('invalid')
    expect(bad.ok).toBe(false)
    const good = await applyBossPackageId('0x' + 'b'.repeat(64))
    expect(good.ok).toBe(true)
  })
})
