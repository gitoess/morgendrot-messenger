import { describe, expect, it } from 'vitest'
import {
  buildForensicMsgWire,
  planForensicBatchTxGroups,
  prepareForensicBatchItem,
} from './einsatz-forensic-batch-entry'
import type { Message } from '@/frontend/lib/types'

const FROM = '0x' + 'a'.repeat(64)
const TO = '0x' + 'b'.repeat(64)

describe('einsatz-forensic-batch-entry', () => {
  it('baut Wire mit Metadaten + Text', async () => {
    const msg: Message = {
      id: 'm1',
      from: FROM,
      recipient: TO,
      content: 'Hallo Welt',
      timestamp: 1_700_000_000_000,
      encrypted: false,
    }
    const item = await prepareForensicBatchItem(msg)
    expect('reason' in item).toBe(false)
    if ('wireUtf8' in item) {
      expect(item.wireUtf8).toContain('Hallo Welt')
      expect(item.wireUtf8).toContain('MORG_FORENSIC_MSG_V1')
      expect(item.meta.payload_mode).toBe('full')
    }
  })

  it('packt nach Byte-Budget in mehrere TXs', () => {
    const prepared = Array.from({ length: 60 }, (_, i) => ({
      messageId: `m${i}`,
      wireUtf8: buildForensicMsgWire(
        {
          v: 1,
          sender: FROM,
          recipient: TO,
          timestamp_ms: i,
          channel: '1:1' as const,
          transport: 'iota' as const,
          content_sha256_hex: 'c'.repeat(64),
          canonical_msg_ref: `${i}`.padStart(64, 'd'),
          payload_mode: 'full' as const,
        },
        `msg ${i}`
      ),
      wireBytes: 8_000,
      meta: {} as never,
    }))
    const plans = planForensicBatchTxGroups(prepared, { maxMsgsPerTx: 50, maxTxWireBytes: 20_000 })
    expect(plans.length).toBeGreaterThan(1)
    expect(plans[0]!.items.length).toBeLessThanOrEqual(2)
  })
})
