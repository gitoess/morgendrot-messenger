import { describe, expect, it, vi, beforeEach } from 'vitest'
import { provisionNewHandoffDevice } from './handoff-provision-new-device'

vi.mock('@/frontend/lib/api/generate-mnemonic', () => ({
  fetchGenerateMnemonic: vi.fn(),
}))
vi.mock('@/frontend/lib/handoff-export-download', () => ({
  downloadHandoffZipExport: vi.fn(),
}))
vi.mock('@/frontend/lib/boss-provision-registry', () => ({
  addBossProvisionRegistryEntry: vi.fn(),
}))
vi.mock('@/frontend/lib/team-roster-pending-store', () => ({
  enqueueRosterPendingSuggestion: vi.fn(),
}))
vi.mock('@/frontend/lib/roster-pending-sync', () => ({
  syncHandoffSuggestionToServer: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/frontend/lib/handoff-last-preset', () => ({
  writeHandoffLastPresetId: vi.fn(),
}))
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(async () => 'data:image/png;base64,qr') },
}))

import { fetchGenerateMnemonic } from '@/frontend/lib/api/generate-mnemonic'
import { downloadHandoffZipExport } from '@/frontend/lib/handoff-export-download'
import { addBossProvisionRegistryEntry } from '@/frontend/lib/boss-provision-registry'
import { enqueueRosterPendingSuggestion } from '@/frontend/lib/team-roster-pending-store'
import { syncHandoffSuggestionToServer } from '@/frontend/lib/roster-pending-sync'

const ADDR = '0x' + 'a'.repeat(64)

describe('provisionNewHandoffDevice', () => {
  beforeEach(() => {
    vi.mocked(fetchGenerateMnemonic).mockResolvedValue({
      ok: true,
      address: ADDR,
      secretKey: 'seed-words-test',
    })
    vi.mocked(downloadHandoffZipExport).mockResolvedValue({ ok: true })
    vi.mocked(addBossProvisionRegistryEntry).mockResolvedValue({
      ok: true,
      entry: {
        id: 'entry-1',
        label: 'Test',
        presetId: 'helfer',
        address: ADDR,
        createdAtIso: new Date().toISOString(),
        seedEnc: {
          crypto: {
            schema: 'morgendrot.handoff.env.enc.v1',
            kdf: 'PBKDF2',
            hash: 'SHA-256',
            iterations: 210000,
            algo: 'AES-256-GCM',
            saltB64: 'c2FsdA==',
            ivB64: 'aXY=',
          },
          ciphertextB64: 'x',
        },
      },
    })
    vi.mocked(enqueueRosterPendingSuggestion).mockReturnValue({
      id: 'rp-1',
      source: 'handoff',
      member: { address: ADDR, name: 'Anna' },
      createdAt: Date.now(),
      handoffLabel: 'helfer',
      registryEntryId: 'entry-1',
    })
  })

  it('erzeugt ZIP, Registry-Eintrag und QR', async () => {
    const buildBody = vi.fn((helperAddress: string) => ({
      handoffLabel: 'Anna',
      roleId: 12,
      helperRole: 'messenger' as const,
      bossAddress: helperAddress,
    }))

    const r = await provisionNewHandoffDevice({
      buildBody,
      presetId: 'helfer',
      label: 'Anna',
      masterPassword: 'boss-master-1',
    })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(buildBody).toHaveBeenCalledWith(ADDR)
    expect(downloadHandoffZipExport).toHaveBeenCalled()
    expect(addBossProvisionRegistryEntry).toHaveBeenCalledWith(
      expect.objectContaining({ address: ADDR, masterPassword: 'boss-master-1' })
    )
    expect(enqueueRosterPendingSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'handoff',
        member: expect.objectContaining({ address: ADDR, name: 'Anna' }),
        registryEntryId: 'entry-1',
      })
    )
    expect(syncHandoffSuggestionToServer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'rp-1',
        member: expect.objectContaining({ address: ADDR, name: 'Anna' }),
        registryEntryId: 'entry-1',
      })
    )
    expect(r.qrDataUrl).toContain('data:image')
    expect(r.entryId).toBe('entry-1')
  })

  it('meldet Mnemonic-Fehler', async () => {
    vi.mocked(fetchGenerateMnemonic).mockResolvedValue({ ok: false, error: 'API down' })
    const r = await provisionNewHandoffDevice({
      buildBody: () => ({ roleId: 12, helperRole: 'messenger' }),
      presetId: 'helfer',
      label: 'X',
      masterPassword: 'pw',
    })
    expect(r).toEqual({ ok: false, error: 'API down' })
  })
})
