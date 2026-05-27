import { describe, expect, it } from 'vitest'
import { buildHandoffExportSummary, formatHandoffAddressShort } from '@/frontend/lib/handoff-export-display'
import {
  buildHandoffPartnerOptions,
  partnerAddressesToCsv,
} from '@/frontend/lib/handoff-export-partners'
import { getHandoffPreset } from '@/frontend/lib/handoff-export-presets'

const A = '0x' + 'a'.repeat(64)
const B = '0x' + 'b'.repeat(64)

describe('handoff-export-display', () => {
  it('formatHandoffAddressShort', () => {
    expect(formatHandoffAddressShort(B)).toMatch(/^0xbbbbbb…bbbbbb$/)
  })

  it('buildHandoffExportSummary', () => {
    const s = buildHandoffExportSummary({
      preset: getHandoffPreset('helfer'),
      bezeichnung: 'THW Einsatz Süd',
      teamMailboxCount: 1,
      partnerCount: 3,
      usesTeamMailboxes: true,
      includeIotaArchivReadme: true,
    })
    expect(s.title).toContain('THW Einsatz Süd')
    expect(s.detail).toContain('3 Partner')
    expect(s.detail).toContain('Meshtastic-PSK')
  })
})

describe('handoff-export-partners', () => {
  it('Partner mit Telefonbuch-Label', () => {
    const opts = buildHandoffPartnerOptions(
      { connectedAddresses: [B], myAddressFull: A } as never,
      { [B]: { label: 'Anna Müller', roleTags: ['THW'] } },
      A
    )
    expect(opts).toHaveLength(1)
    expect(opts[0]!.label).toContain('Anna Müller')
    expect(partnerAddressesToCsv([B])).toBe(B)
  })
})
