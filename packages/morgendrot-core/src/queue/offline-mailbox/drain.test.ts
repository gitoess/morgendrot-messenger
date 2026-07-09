import { describe, it, expect } from 'vitest'
import { OFFLINE_QUEUE_ITEM_STATUS, type OfflineMailboxQueueItem } from './model'
import { drainOfflineMailboxOnce, runOfflineMailboxDrainCycle } from './drain'
import type { OfflineMailboxSendPort } from './send-port'
import { createOfflineMailboxTrySendFromSendPort } from './send-port'

function plainItem(id: string, recipient: string, payload: string, seq: number): OfflineMailboxQueueItem {
  return {
    id,
    kind: 'plain_send',
    status: OFFLINE_QUEUE_ITEM_STATUS.PENDING,
    recipient,
    payload,
    encrypted: false,
    timeIsTrusted: false,
    clientOutSeq: seq,
    createdAt: seq,
    attempts: 0,
    lastAttemptAt: 0,
    priority: 100,
  }
}

function encItem(id: string, payload: string, seq: number): OfflineMailboxQueueItem {
  return {
    id,
    kind: 'encrypted_send',
    status: OFFLINE_QUEUE_ITEM_STATUS.PENDING,
    recipient: '0xr',
    payload,
    encrypted: true,
    timeIsTrusted: false,
    clientOutSeq: seq,
    createdAt: seq,
    attempts: 0,
    lastAttemptAt: 0,
    priority: 100,
  }
}

describe('drainOfflineMailboxOnce', () => {
  it('sendet plain und entfernt bei Erfolg', async () => {
    const send: OfflineMailboxSendPort = {
      sendEncrypted: async () => ({ ok: false }),
      sendPlain: async () => ({ ok: true }),
    }
    const sorted = [plainItem('1', '0xa', 'hi', 1)]
    const r = await drainOfflineMailboxOnce(sorted, 1_000_000, createOfflineMailboxTrySendFromSendPort(send))
    expect(r.sent).toBe(1)
    expect(r.failed).toBe(0)
    expect(r.kept).toHaveLength(0)
  })

  it('bei Fehler bumped Eintrag', async () => {
    const send: OfflineMailboxSendPort = {
      sendEncrypted: async () => ({ ok: true }),
      sendPlain: async () => ({ ok: false, error: 'netz' }),
    }
    const sorted = [plainItem('1', '0xb', 'x', 1)]
    const r = await drainOfflineMailboxOnce(sorted, 2_000_000, createOfflineMailboxTrySendFromSendPort(send))
    expect(r.sent).toBe(0)
    expect(r.failed).toBe(1)
    expect(r.kept).toHaveLength(1)
    expect(r.kept[0]?.attempts).toBe(1)
    expect(r.kept[0]?.lastError).toBe('netz')
  })

  it('encrypted_send nutzt sendEncrypted', async () => {
    let usedRecipient = ''
    let used = ''
    const send: OfflineMailboxSendPort = {
      sendEncrypted: async (recipient, p) => {
        usedRecipient = recipient
        used = p
        return { ok: true }
      },
      sendPlain: async () => ({ ok: false }),
    }
    const sorted = [encItem('e', 'wire-body', 1)]
    await drainOfflineMailboxOnce(sorted, 3_000_000, createOfflineMailboxTrySendFromSendPort(send))
    expect(usedRecipient).toBe('0xr')
    expect(used).toBe('wire-body')
  })
})

describe('runOfflineMailboxDrainCycle', () => {
  it('persistiert über load/save', async () => {
    let stored: OfflineMailboxQueueItem[] = [plainItem('1', '0xa', 'hi', 1)]
    const trySend = createOfflineMailboxTrySendFromSendPort({
      sendEncrypted: async () => ({ ok: false }),
      sendPlain: async () => ({ ok: true }),
    })
    const r = await runOfflineMailboxDrainCycle(
      {
        load: () => stored,
        save: (items) => {
          stored = items
        },
        nowMs: 9_000_000,
      },
      trySend
    )
    expect(r.sent).toBe(1)
    expect(r.remaining).toBe(0)
    expect(stored).toHaveLength(0)
  })
})
