import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'

vi.mock('@/frontend/lib/direct-iota-plain-submit', () => ({
  canTryLivePlaintextDirectMailbox: vi.fn(() => true),
  trySubmitPlaintextMailboxViaDirectIota: vi.fn(),
}))

vi.mock('@/frontend/lib/active-network-chain-sync', () => ({
  syncActiveNetworkChainSnapshot: vi.fn(),
  formatMainnetDirectSendBlockedMessage: vi.fn(() => 'Mainnet blockiert'),
}))

vi.mock('@/frontend/lib/direct-iota-encrypted-send-prep', () => ({
  prepareEncryptedDirectSend: vi.fn(),
}))

vi.mock('@/frontend/lib/messenger-standalone-relay', () => ({
  shouldSkipMessengerApiRelayFallback: vi.fn(() => false),
}))

vi.mock('@/frontend/lib/direct-chat-ecdh-session', () => ({
  getDirectChatEcdhMaterialForRecipient: vi.fn(),
}))

vi.mock('@/frontend/lib/direct-iota-encrypted-submit', () => ({
  trySubmitEncryptedMailboxViaDirectIotaFromPlaintext: vi.fn(),
}))

vi.mock('@/frontend/lib/direct-iota-vault-unlock-sync', () => ({
  tryAutoRestoreDirectIotaSessionSigner: vi.fn(),
  tryAutoRestoreDirectIotaSessionSignerAsync: vi.fn().mockResolvedValue(undefined),
  tryAutoRestoreDirectChatEcdhPrivateKey: vi.fn(async () => ({ ok: false })),
}))

vi.mock('@/frontend/lib/einsatz-network-profiles', () => ({
  readNetworkProfilesState: vi.fn(() => ({ active: 'testnet', testnet: {}, mainnet: {} })),
  validateNetworkProfile: vi.fn(() => ({ ok: false })),
}))

vi.mock('@/frontend/lib/api/chat-commands', () => ({
  sendMessage: vi.fn(),
  sendEncryptedMessageWithTimeout: vi.fn(),
}))

import { sendMessage } from '@/frontend/lib/api/chat-commands'
import { trySubmitPlaintextMailboxViaDirectIota } from '@/frontend/lib/direct-iota-plain-submit'
import { sendPlaintextMailboxHybrid, sendEncryptedMailboxHybrid } from '@/frontend/lib/mailbox-send-hybrid'
import { prepareEncryptedDirectSend } from '@/frontend/lib/direct-iota-encrypted-send-prep'
import { getDirectChatEcdhMaterialForRecipient } from '@/frontend/lib/direct-chat-ecdh-session'
import { trySubmitEncryptedMailboxViaDirectIotaFromPlaintext } from '@/frontend/lib/direct-iota-encrypted-submit'
import { readNetworkProfilesState, validateNetworkProfile } from '@/frontend/lib/einsatz-network-profiles'

describe('mailbox-send-hybrid (H.15 Phase 2)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    vi.mocked(trySubmitPlaintextMailboxViaDirectIota).mockReset()
    vi.mocked(sendMessage).mockReset()
    vi.mocked(readNetworkProfilesState).mockReturnValue({
      active: 'testnet',
      testnet: { rpcUrl: '', packageId: '', mailboxId: '' },
      mainnet: { rpcUrl: '', packageId: '', mailboxId: '' },
    } as ReturnType<typeof readNetworkProfilesState>)
    vi.mocked(validateNetworkProfile).mockReturnValue({ ok: false, missing: ['RPC-URL'] })
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
    vi.mocked(sendMessage).mockResolvedValue({ ok: true, txDigest: '0xabc' })

    const r = await sendPlaintextMailboxHybrid('0x' + 'bb'.repeat(32), 'hi', BigInt(2))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.txDigest).toBe('0xabc')
  })

  it('verschlüsselt Event auf Mainnet per Direct (ohne /api)', async () => {
    vi.mocked(readNetworkProfilesState).mockReturnValue({
      active: 'mainnet',
      mainnet: {
        rpcUrl: 'https://rpc.example',
        packageId: '0x' + '11'.repeat(32),
        mailboxId: '0x' + '22'.repeat(32),
        senderAddress: '0x' + '33'.repeat(32),
      },
      testnet: { rpcUrl: '', packageId: '', mailboxId: '' },
    } as ReturnType<typeof readNetworkProfilesState>)
    vi.mocked(validateNetworkProfile).mockReturnValue({ ok: true, missing: [] })
    vi.mocked(prepareEncryptedDirectSend).mockResolvedValue({ ok: true })
    vi.mocked(getDirectChatEcdhMaterialForRecipient).mockReturnValue({
      peerPubRaw: new Uint8Array(65),
      ecdhPrivateKey: {} as CryptoKey,
    })
    vi.mocked(trySubmitEncryptedMailboxViaDirectIotaFromPlaintext).mockResolvedValue({
      ok: true,
      digest: '0xenc',
    })

    const r = await sendEncryptedMailboxHybrid('0x' + 'cc'.repeat(32), 'secret', {
      messagingPersistenceMode: 'event',
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.txDigest).toBe('0xenc')
    expect(trySubmitEncryptedMailboxViaDirectIotaFromPlaintext).toHaveBeenCalledWith(
      expect.objectContaining({ messagingPersistenceMode: 'event' })
    )
  })

  it('verschlüsselt Mainnet: Direct-Fehler ohne irreführende Mailbox-Hinweis', async () => {
    vi.mocked(readNetworkProfilesState).mockReturnValue({
      active: 'mainnet',
      mainnet: {
        rpcUrl: 'https://rpc.example',
        packageId: '0x' + '11'.repeat(32),
        mailboxId: '0x' + '22'.repeat(32),
        senderAddress: '0x' + '33'.repeat(32),
      },
      testnet: { rpcUrl: '', packageId: '', mailboxId: '' },
    } as ReturnType<typeof readNetworkProfilesState>)
    vi.mocked(validateNetworkProfile).mockReturnValue({ ok: true, missing: [] })
    vi.mocked(prepareEncryptedDirectSend).mockResolvedValue({
      ok: false,
      error: 'Chat-ECDH-Privatkey fehlt',
    })

    const r = await sendEncryptedMailboxHybrid('0x' + 'dd'.repeat(32), 'secret', {
      messagingPersistenceMode: 'event',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toContain('Chat-ECDH-Privatkey fehlt')
      expect(r.error).not.toContain('Persistenz „Mailbox“')
    }
  })
})
