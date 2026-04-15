import { describe, expect, it, vi } from 'vitest'
import { ATTESTATION_QUEUE_ITEM_STATUS } from './model'
import { drainAttestationQueueOnce, enqueueAttestationDraft, parseAttestationQueueJson } from './queue'

const draft = (ref: string | null) =>
  ({
    manifestVersion: 1 as const,
    canonicalMsgRefHex: ref,
    observedAtMs: 1,
    timeIsTrusted: true,
  }) as const

describe('attestation queue', () => {
  it('enqueue + drain success removes item', async () => {
    const en = enqueueAttestationDraft({
      items: [],
      id: 'a',
      draft: draft('ab'.repeat(32)),
      now: 10,
    })
    expect(en.ok).toBe(true)
    if (!en.ok) return
    const r = await drainAttestationQueueOnce({
      items: en.items,
      nowMs: 1000,
      submit: vi.fn().mockResolvedValue({ ok: true, chainDigest: '0xdigest' }),
    })
    expect(r.sent).toBe(1)
    expect(r.items.length).toBe(0)
  })

  it('drain failure keeps item as failed', async () => {
    const en = enqueueAttestationDraft({
      items: [],
      id: 'b',
      draft: draft(null),
      now: 1,
    })
    expect(en.ok).toBe(true)
    if (!en.ok) return
    const r = await drainAttestationQueueOnce({
      items: en.items,
      nowMs: 5_000,
      submit: vi.fn().mockResolvedValue({ ok: false, error: 'offline' }),
    })
    expect(r.sent).toBe(0)
    expect(r.failed).toBe(1)
    expect(r.items[0]?.status).toBe(ATTESTATION_QUEUE_ITEM_STATUS.failed)
    expect(r.items[0]?.attempts).toBe(1)
  })

  it('parse roundtrip', () => {
    const items = parseAttestationQueueJson(
      JSON.stringify([
        {
          id: 'x',
          status: 'pending',
          draft: draft(null),
          createdAt: 3,
          attempts: 0,
          lastAttemptAt: 0,
        },
      ])
    )
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe('x')
  })
})
