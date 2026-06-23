import { describe, expect, it } from 'vitest'
import { buildSosLageBundlePreview, formatSosLageBundlePlaintext } from '@/frontend/lib/sos-lage-bundle'

describe('sos-lage-bundle', () => {
  it('baut Vorschau und Klartext', () => {
    const bundle = buildSosLageBundlePreview({
      freeText: 'Hilfe benötigt',
      apiStatus: { packageId: '0xpkg', handoffLabel: 'Alpha' },
      myAddress: '0x' + 'c'.repeat(64),
    })
    expect(bundle.displayName).toBe('Alpha')
    const text = formatSosLageBundlePlaintext(bundle)
    expect(text).toContain('Hilfe benötigt')
    expect(text).toContain('0x' + 'c'.repeat(64))
  })
})
