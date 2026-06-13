import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchInboxFromAllOwnedMailboxes } from '@/frontend/lib/inbox-multi-mailbox-fetch'

const fetchInbox = vi.fn()
vi.mock('@/frontend/lib/api/inbox', () => ({ fetchInbox: (...args: unknown[]) => fetchInbox(...args) }))

const readActiveSendMailboxObjectId = vi.fn()
vi.mock('@/frontend/lib/my-mailbox-active', () => ({
  readActiveSendMailboxObjectId: () => readActiveSendMailboxObjectId(),
}))

const tryFetchDirectMailboxInboxViaIota = vi.fn()
vi.mock('@/frontend/lib/direct-iota-inbox-fetch', () => ({
  tryFetchDirectMailboxInboxViaIota: (...args: unknown[]) => tryFetchDirectMailboxInboxViaIota(...args),
}))

const shouldSkipMessengerApiRelayFallback = vi.fn(() => false)
vi.mock('@/frontend/lib/messenger-standalone-relay', () => ({
  shouldSkipMessengerApiRelayFallback: () => shouldSkipMessengerApiRelayFallback(),
}))

const MB_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const MB_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

describe('fetchInboxFromAllOwnedMailboxes', () => {
  beforeEach(() => {
    fetchInbox.mockReset()
    tryFetchDirectMailboxInboxViaIota.mockReset()
    tryFetchDirectMailboxInboxViaIota.mockResolvedValue({ ok: false, error: 'direct skipped' })
    shouldSkipMessengerApiRelayFallback.mockReturnValue(false)
    readActiveSendMailboxObjectId.mockReturnValue('')
  })

  it('Standalone ohne Basis: kein /inbox-Fallback wenn Direkt-RPC fehlschlägt', async () => {
    shouldSkipMessengerApiRelayFallback.mockReturnValue(true)
    const r = await fetchInboxFromAllOwnedMailboxes({ limit: 50, offset: 0, includePrivateMailboxes: false })
    expect(r.ok).toBe(false)
    expect(fetchInbox).not.toHaveBeenCalled()
    expect(r.error).toMatch(/direct skipped/)
  })

  it('private Mailbox: Direkt-RPC mit mailboxObjectId, ohne /inbox für private', async () => {
    readActiveSendMailboxObjectId.mockReturnValue(MB_A)
    tryFetchDirectMailboxInboxViaIota
      .mockResolvedValueOnce({
        ok: true,
        rows: [{ sender: '0xs', text: 'shared rpc', isPlain: true, nonce: '1', chainPurgeable: true }],
      })
      .mockResolvedValueOnce({
        ok: true,
        rows: [{ sender: '0xs', text: 'private rpc', isPlain: true, nonce: '2', chainPurgeable: true }],
      })
    fetchInbox.mockResolvedValueOnce({ ok: true, messages: [] })
    const r = await fetchInboxFromAllOwnedMailboxes({ limit: 50, offset: 0, includePrivateMailboxes: true })
    expect(r.ok).toBe(true)
    expect(r.loadedViaRpc).toBe(true)
    expect(fetchInbox).toHaveBeenCalledTimes(1)
    expect(tryFetchDirectMailboxInboxViaIota).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ mailboxObjectId: MB_A, offset: 0 })
    )
    expect(r.messages.some((m) => m.content.includes('private rpc'))).toBe(true)
  })

  it('dedupliziert identische Zeile aus API und Direkt-RPC', async () => {
    const nonce = '1781371408086'
    const row = { sender: '0xs', text: 'mainnet', isPlain: true, nonce, ts: 1781371408086, chainPurgeable: true }
    tryFetchDirectMailboxInboxViaIota.mockResolvedValueOnce({ ok: true, rows: [row] })
    fetchInbox.mockResolvedValueOnce({ ok: true, messages: [{ ...row, inboxKey: 'mbp:0xs:0xr:1781371408086:1781371408086' }] })
    const r = await fetchInboxFromAllOwnedMailboxes({ limit: 50, offset: 0, includePrivateMailboxes: false })
    expect(r.ok).toBe(true)
    expect(r.messages.filter((m) => m.content.includes('mainnet'))).toHaveLength(1)
  })

  it('Shared-Posteingang: Direkt-RPC + API-Union wenn Relay erreichbar', async () => {
    tryFetchDirectMailboxInboxViaIota.mockResolvedValueOnce({
      ok: true,
      rows: [{ sender: '0xs', text: 'via rpc', isPlain: true, nonce: '1', chainPurgeable: true }],
    })
    fetchInbox.mockResolvedValueOnce({
      ok: true,
      messages: [{ sender: '0xs', text: 'via api', isPlain: true, nonce: '2', chainPurgeable: true }],
    })
    const r = await fetchInboxFromAllOwnedMailboxes({ limit: 50, offset: 0, includePrivateMailboxes: false })
    expect(r.ok).toBe(true)
    expect(r.loadedViaRpc).toBe(true)
    expect(tryFetchDirectMailboxInboxViaIota).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50, offset: 0 })
    )
    expect(fetchInbox).toHaveBeenCalledTimes(1)
    expect(r.messages.some((m) => m.content.includes('via rpc'))).toBe(true)
    expect(r.messages.some((m) => m.content.includes('via api'))).toBe(true)
  })

  it('Shared-Posteingang: nur Direkt-RPC im Standalone-Modus', async () => {
    shouldSkipMessengerApiRelayFallback.mockReturnValue(true)
    tryFetchDirectMailboxInboxViaIota.mockResolvedValueOnce({
      ok: true,
      rows: [{ sender: '0xs', text: 'via rpc', isPlain: true, nonce: '1', chainPurgeable: true }],
    })
    const r = await fetchInboxFromAllOwnedMailboxes({ limit: 50, offset: 0, includePrivateMailboxes: false })
    expect(r.ok).toBe(true)
    expect(r.loadedViaRpc).toBe(true)
    expect(fetchInbox).not.toHaveBeenCalled()
    expect(r.messages.some((m) => m.content.includes('via rpc'))).toBe(true)
  })

  it('ruft Shared und nur die aktive private Mailbox auf', async () => {
    readActiveSendMailboxObjectId.mockReturnValue(MB_A)
    fetchInbox
      .mockResolvedValueOnce({
        ok: true,
        messages: [
          { sender: '0xs', text: 'shared', isPlain: true, nonce: '1', chainPurgeable: true },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        messages: [
          { sender: '0xs', text: 'priv enc', isPlain: false, nonce: '2', chainPurgeable: true },
        ],
      })

    const r = await fetchInboxFromAllOwnedMailboxes({ limit: 50, offset: 0, includePrivateMailboxes: true })
    expect(r.ok).toBe(true)
    expect(r.hasMore).toBe(false)
    expect(fetchInbox).toHaveBeenCalledTimes(2)
    expect(fetchInbox.mock.calls[0]?.[6]).toBeUndefined()
    expect(fetchInbox.mock.calls[1]?.[6]).toBe(MB_A)
    expect(r.messages).toHaveLength(2)
    expect(r.messages.some((m) => m.encrypted)).toBe(true)
  })

  it('ohne aktive private nur Shared', async () => {
    readActiveSendMailboxObjectId.mockReturnValue('')
    fetchInbox.mockResolvedValueOnce({
      ok: true,
      messages: [{ sender: '0xs', text: 'shared only', isPlain: true, nonce: '1', chainPurgeable: true }],
    })
    const r = await fetchInboxFromAllOwnedMailboxes({ limit: 50, offset: 0, includePrivateMailboxes: true })
    expect(fetchInbox).toHaveBeenCalledTimes(1)
    expect(r.messages).toHaveLength(1)
  })

  it('Poll: nur Shared, silentFetch', async () => {
    fetchInbox.mockResolvedValueOnce({
      ok: true,
      messages: [{ sender: '0xs', text: 'poll', isPlain: true, nonce: '9', chainPurgeable: true }],
    })
    await fetchInboxFromAllOwnedMailboxes({ limit: 40, offset: 0, includePrivateMailboxes: false, silent: true })
    expect(fetchInbox).toHaveBeenCalledTimes(1)
    expect(fetchInbox.mock.calls[0]?.[7]).toBe(true)
  })

  it('erster Fetch immer Shared-Union (undefined), nicht explizite Server-Object-ID', async () => {
    fetchInbox.mockResolvedValueOnce({ ok: true, messages: [] })
    await fetchInboxFromAllOwnedMailboxes({
      limit: 50,
      offset: 0,
      serverMailboxId: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      includePrivateMailboxes: false,
    })
    expect(fetchInbox.mock.calls[0]?.[6]).toBeUndefined()
  })

  it('Poll: Shared + alsoMailboxIds ohne alle privaten', async () => {
    fetchInbox
      .mockResolvedValueOnce({
        ok: true,
        messages: [{ sender: '0xs', text: 'shared', isPlain: true, nonce: '1', chainPurgeable: true }],
      })
      .mockResolvedValueOnce({
        ok: true,
        messages: [{ sender: '0xs', text: 'active priv', isPlain: false, nonce: '2', chainPurgeable: true }],
      })
    await fetchInboxFromAllOwnedMailboxes({
      limit: 40,
      offset: 0,
      includePrivateMailboxes: false,
      alsoMailboxIds: [MB_A],
      silent: true,
    })
    expect(fetchInbox).toHaveBeenCalledTimes(2)
    expect(fetchInbox.mock.calls[1]?.[6]).toBe(MB_A)
  })
})
