import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'

vi.mock('@/frontend/lib/direct-iota-plain-submit', () => ({
  canTryLivePlaintextDirectMailbox: vi.fn(() => true),
  trySubmitPlaintextMailboxViaDirectIota: vi.fn(),
}))

vi.mock('@/frontend/lib/direct-iota-encrypted-submit', () => ({
  canTryLiveEncryptedDirectMailbox: vi.fn(() => false),
  trySubmitEncryptedMailboxViaDirectIotaFromPlaintext: vi.fn(),
}))

vi.mock('@/frontend/lib/api/chat-commands', () => ({
  sendMessage: vi.fn(),
  sendEncryptedMessageWithTimeout: vi.fn(),
}))

import { sendMessage } from '@/frontend/lib/api/chat-commands'
import { trySubmitPlaintextMailboxViaDirectIota } from '@/frontend/lib/direct-iota-plain-submit'
import { sendPlaintextMailboxHybrid } from '@/frontend/lib/mailbox-send-hybrid'

describe('mailbox-send-hybrid (H.15 Phase 2)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    vi.mocked(trySubmitPlaintextMailboxViaDirectIota).mockReset()
    vi.mocked(sendMessage).mockReset()
  })

  it('meldet Direct- und Relay-Fehler zusammen', async () => {
    vi.mocked(trySubmitPlaintextMailboxViaDirectIota).mockResolvedValue({
      ok: false,
      error: 'Fullnode nicht erreichbar',
    })
    vi.mocked(sendMessage).mockResolvedValue({ ok: false, error: 'Basis offline' })

    const r = await sendPlaintextMailboxHybrid('0x' + 'aa'.repeat(32), 'hi', BigInt(1))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toContain('Direkt-RPC')
      expect(r.error).toContain('Relay/API')
      expect(r.error).toContain('Fullnode')
      expect(r.error).toContain('Basis offline')
    }
  })

  it('Relay-Erfolg nach Direct-Fehler', async () => {
    vi.mocked(trySubmitPlaintextMailboxViaDirectIota).mockResolvedValue({
      ok: false,
      error: 'RPC timeout',
    })
    vi.mocked(sendMessage).mockResolvedValue({ ok: true, digest: '0xabc' })

    const r = await sendPlaintextMailboxHybrid('0x' + 'bb'.repeat(32), 'hi', BigInt(2))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.txDigest).toBe('0xabc')
  })
})
