import { afterEach, describe, expect, it } from 'vitest'
import {
  clearNftActivity,
  listNftActivity,
  recordNftActivity,
  syncNftOwnedSnapshotAndDetectReceived,
} from '@/frontend/lib/nft-activity-local-log'

const A = '0x' + 'aa'.repeat(32)
const B = '0x' + 'bb'.repeat(32)

describe('nft-activity-local-log', () => {
  afterEach(() => {
    clearNftActivity()
    window.localStorage.clear()
  })

  it('zeichnet sent/burned und erkennt received nach Snapshot', () => {
    expect(recordNftActivity({ kind: 'sent', objectId: A, counterparty: B, digest: 'd1' })?.kind).toBe(
      'sent'
    )
    expect(listNftActivity()[0]?.objectId).toBe(A)

    // Baseline — kein received
    expect(syncNftOwnedSnapshotAndDetectReceived([A])).toHaveLength(0)
    // Neu hinzugekommen
    const got = syncNftOwnedSnapshotAndDetectReceived([A, B], { [B]: 'Bild B' })
    expect(got).toHaveLength(1)
    expect(got[0]?.kind).toBe('received')
    expect(got[0]?.objectId).toBe(B)
  })
})
