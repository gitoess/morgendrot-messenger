import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchInboxFromAllOwnedMailboxes } from '@/frontend/lib/inbox-multi-mailbox-fetch'

const fetchInbox = vi.fn()
vi.mock('@/frontend/lib/api/inbox', () => ({ fetchInbox: (...args: unknown[]) => fetchInbox(...args) }))

const readActiveSendMailboxObjectId = vi.fn()
vi.mock('@/frontend/lib/my-mailbox-active', () => ({
  readActiveSendMailboxObjectId: () => readActiveSendMailboxObjectId(),
}))

const MB_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const MB_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

describe('fetchInboxFromAllOwnedMailboxes', () => {
  beforeEach(() => {
    fetchInbox.mockReset()
    readActiveSendMailboxObjectId.mockReturnValue('')
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
