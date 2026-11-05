import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/frontend/lib/direct-session-keys-archive', () => ({
  getSendKeyEpochForRecipient: vi.fn(() => 1),
}))

describe('takeEncryptedSendKeyEpochRenewHint', () => {
  afterEach(() => {
    window.sessionStorage.clear()
    vi.resetModules()
  })

  it('hints once per peer while epoch is 1', async () => {
    const { takeEncryptedSendKeyEpochRenewHint } = await import('@/frontend/lib/session-epoch-renew-hint')
    const peer = '0x' + '11'.repeat(32)
    const a = takeEncryptedSendKeyEpochRenewHint(peer)
    const b = takeEncryptedSendKeyEpochRenewHint(peer)
    expect(a).toMatch(/Schlüssel erneuern/)
    expect(b).toBeNull()
  })
})
