import { describe, it, expect, vi, beforeEach } from 'vitest'

const fetchInbox = vi.fn()
const tryFetchDirectMailboxInboxViaIota = vi.fn()
const shouldSkipMessengerApiRelayFallback = vi.fn(() => false)
const readActiveSendMailboxObjectId = vi.fn(() => '')
const readMyPrivateMailboxes = vi.fn(() => [])
const collectInboxAlsoMailboxIds = vi.fn((): string[] => [])

vi.mock('@/frontend/lib/api/execute-command', () => ({
  executeCommand: (...args: unknown[]) => fetchInbox(...args),
}))

vi.mock('@/frontend/lib/direct-iota-inbox-fetch', () => ({
  tryFetchDirectMailboxInboxViaIota: (...args: unknown[]) => tryFetchDirectMailboxInboxViaIota(...args),
}))

vi.mock('@/frontend/lib/messenger-standalone-relay', () => ({
  shouldSkipMessengerApiRelayFallback: () => shouldSkipMessengerApiRelayFallback(),
}))

vi.mock('@/frontend/lib/my-mailbox-active', () => ({
  readActiveSendMailboxObjectId: () => readActiveSendMailboxObjectId(),
}))

vi.mock('@/frontend/lib/my-private-mailbox-store', () => ({
  readMyPrivateMailboxes: () => readMyPrivateMailboxes(),
}))

vi.mock('@/frontend/lib/inbox-also-mailbox-ids', () => ({
  collectInboxAlsoMailboxIds: () => collectInboxAlsoMailboxIds(),
}))

import { fetchAllInboxMessagesForExport, fetchAllPagesFromOneMailbox } from '@/frontend/lib/api/inbox'

function row(text: string, nonce: string, ts: number) {
  return { sender: '0xs', text, isPlain: true, nonce, ts, chainPurgeable: true }
}

describe('fetchAllPagesFromOneMailbox', () => {
  beforeEach(() => {
    fetchInbox.mockReset()
    tryFetchDirectMailboxInboxViaIota.mockReset()
    shouldSkipMessengerApiRelayFallback.mockReturnValue(false)
  })

  it('merged API + Direct und paginiert weiter trotz kurzer Direct-Seite', async () => {
    // Direct nur Seite 0; weitere Seiten nur API (kein Indexer-Rescan).
    tryFetchDirectMailboxInboxViaIota.mockResolvedValueOnce({
      ok: true,
      rows: [row('direct-only', '1', 100)],
    })
    fetchInbox
      .mockResolvedValueOnce({
        ok: true,
        messages: [row('api-a', '10', 200), row('api-b', '11', 201)],
        hasMore: true,
      })
      .mockResolvedValueOnce({
        ok: true,
        messages: [row('api-c', '12', 202)],
        hasMore: false,
      })

    const msgs = await fetchAllPagesFromOneMailbox({ pageSize: 2, mergeLocalInbox: true })
    const texts = msgs.map((m) => m.content)
    expect(texts.some((t) => t.includes('direct-only'))).toBe(true)
    expect(texts.some((t) => t.includes('api-a'))).toBe(true)
    expect(texts.some((t) => t.includes('api-c'))).toBe(true)
    expect(fetchInbox).toHaveBeenCalledTimes(2)
    expect(tryFetchDirectMailboxInboxViaIota).toHaveBeenCalledTimes(1)
  })
})

describe('fetchAllInboxMessagesForExport', () => {
  beforeEach(() => {
    fetchInbox.mockReset()
    tryFetchDirectMailboxInboxViaIota.mockReset()
    tryFetchDirectMailboxInboxViaIota.mockResolvedValue({ ok: false, error: 'skip' })
    shouldSkipMessengerApiRelayFallback.mockReturnValue(false)
    readActiveSendMailboxObjectId.mockReturnValue('')
    readMyPrivateMailboxes.mockReturnValue([])
    collectInboxAlsoMailboxIds.mockReturnValue([])
  })

  it('breitet shared-Array aus (kein nested Message[])', async () => {
    fetchInbox.mockResolvedValueOnce({
      ok: true,
      messages: [row('s1', '1', 1), row('s2', '2', 2)],
      hasMore: false,
    })
    const msgs = await fetchAllInboxMessagesForExport({ bossView: false, role: 'user', pageSize: 50 })
    expect(msgs).toHaveLength(2)
    expect(msgs.every((m) => typeof m.id === 'string' && typeof m.content === 'string')).toBe(true)
  })

  it('lädt Team-Mailboxen zusätzlich', async () => {
    const teamMb = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
    collectInboxAlsoMailboxIds.mockReturnValue([teamMb])
    fetchInbox
      .mockResolvedValueOnce({
        ok: true,
        messages: [row('shared', '1', 1)],
        hasMore: false,
      })
      .mockResolvedValueOnce({
        ok: true,
        messages: [row('team-msg', '9', 9)],
        hasMore: false,
      })

    const msgs = await fetchAllInboxMessagesForExport({ bossView: false, role: 'user', pageSize: 50 })
    expect(msgs.some((m) => m.content.includes('shared'))).toBe(true)
    expect(msgs.some((m) => m.content.includes('team-msg'))).toBe(true)
    expect(fetchInbox).toHaveBeenCalledWith(
      '/inbox',
      expect.any(Array),
      expect.objectContaining({
        mailboxObjectId: teamMb,
        silentFetch: true,
        mailboxKeysOnly: true,
      })
    )
  })
})
