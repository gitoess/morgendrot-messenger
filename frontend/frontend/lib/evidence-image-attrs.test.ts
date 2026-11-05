import { describe, expect, it } from 'vitest'
import {
  packEvidenceDescription,
  sanitizeEvidenceAttrPairs,
  unpackEvidenceDescription,
} from '@/frontend/lib/evidence-image-attrs'

describe('evidence-image-attrs', () => {
  it('pack/unpack roundtrip', () => {
    const packed = packEvidenceDescription('Hinweis', [
      { key: 'einsatz', value: 'Alpha' },
      { key: 'ort', value: 'Nord' },
    ])
    expect(packed).toContain('[morg-attrs]')
    expect(packed).toContain('einsatz=Alpha')
    const u = unpackEvidenceDescription(packed)
    expect(u.body).toBe('Hinweis')
    expect(u.attrs).toEqual([
      { key: 'einsatz', value: 'Alpha' },
      { key: 'ort', value: 'Nord' },
    ])
  })

  it('sanitizes bad keys and caps pairs', () => {
    const clean = sanitizeEvidenceAttrPairs([
      { key: '1bad', value: 'x' },
      { key: 'ok', value: 'y' },
      { key: 'ok', value: 'dup' },
      { key: '', value: 'z' },
    ])
    expect(clean).toEqual([{ key: 'ok', value: 'y' }])
  })

  it('respektiert maxTotal', () => {
    const packed = packEvidenceDescription('kurz', [{ key: 'a', value: 'b'.repeat(80) }], 40)
    expect(packed.length).toBeLessThanOrEqual(40)
  })
})
