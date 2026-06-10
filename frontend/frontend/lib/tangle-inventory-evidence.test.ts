import { describe, expect, it } from 'vitest'
import type { TangleInventoryItem } from '@/frontend/lib/tangle-inventory'
import { buildTangleEvidenceRecord } from '@/frontend/lib/tangle-inventory-evidence'

describe('buildTangleEvidenceRecord', () => {
  it('includes digest, explorer and metadata', () => {
    const item: TangleInventoryItem = {
      id: '1',
      digest: '0x' + 'a'.repeat(64),
      timestamp: 1_700_000_000_000,
      type: 'text',
      status: 'anchored',
      origin: 'mailbox',
      nonce: '42',
      encrypted: false,
      contentPreview: 'Hallo',
      evidenceSecuredAt: 1_700_000_000_100,
    }
    const rec = buildTangleEvidenceRecord(item)
    expect(rec.schema).toBe('morgendrot.tangle-evidence.v1')
    expect(rec.digest).toBe(item.digest)
    expect(rec.explorerUrl).toContain('0x')
    expect(rec.messageText).toBe('Hallo')
    expect(rec.nonce).toBe('42')
    expect(rec.evidenceSecuredAt).toBe(item.evidenceSecuredAt)
  })
})
