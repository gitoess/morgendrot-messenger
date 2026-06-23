import { describe, expect, it } from 'vitest'
import { countMeshExportCandidates, meshExportSummaryLine } from '@/frontend/lib/contact-mesh-export-stats'

const W = `0x${'a'.repeat(64)}`

describe('contact-mesh-export-stats', () => {
  it('zählt nur 0x-Kontakte mit Funk-Feldern', () => {
    const stats = countMeshExportCandidates({
      [W]: { label: 'A', meshNodeId: '!abc' },
      'tg:123': { label: 'T', meshNodeId: 'x' },
      [`0x${'b'.repeat(64)}`]: { label: 'B' },
    })
    expect(stats.walletContacts).toBe(2)
    expect(stats.withMeshData).toBe(1)
    expect(meshExportSummaryLine(stats)).toContain('1 von 2')
  })
})
