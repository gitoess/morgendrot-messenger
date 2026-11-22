import { describe, expect, it } from 'vitest'
import { buildMorgPkgExportPartnerOptions } from '@/frontend/lib/morg-pkg-export-partners'

const A = '0x' + 'a'.repeat(64)
const B = '0x' + 'b'.repeat(64)

describe('buildMorgPkgExportPartnerOptions', () => {
  it('enthält Ich wenn Self in peerMap', () => {
    const opts = buildMorgPkgExportPartnerOptions([A, B], {}, A)
    expect(opts.some((o) => o.self && o.address === A)).toBe(true)
    expect(opts[0]?.self).toBe(true)
    expect(opts.find((o) => o.address === B)?.self).toBeFalsy()
  })

  it('ohne myAddress kein self-Flag', () => {
    const opts = buildMorgPkgExportPartnerOptions([A], {}, undefined)
    expect(opts).toHaveLength(1)
    expect(opts[0]?.self).toBeFalsy()
  })
})
